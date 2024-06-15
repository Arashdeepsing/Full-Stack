// routes/index.js
import express from 'express';
import redisClient from '../cache.js';

const router = express.Router();
const CACHE_KEY_PREFIX = 'movie_';

// Sample in-memory movie storage for demonstration purposes
let movies = [{
    id: 1,
    name: 'Inception',
    title: 'Sci-Fi'
  },
  {
    id: 2,
    name: 'The Matrix',
    title: 'Sci-Fi'
  },

];

// Cache-aside implementation for fetching a movie
router.get('/movies/:id', (req, res) => {
  const movieId = req.params.id;
  const cacheKey = `${CACHE_KEY_PREFIX}${movieId}`;

  // Check if the movie is in the cache
  redisClient.get(cacheKey, (err, cachedMovie) => {
    if (err) return res.status(500).send(err.message);

    if (cachedMovie) {
      // Movie found in cache
      return res.json(JSON.parse(cachedMovie));
    } else {
      // Movie not in cache, fetch from in-memory storage
      const movie = movies.find(m => m.id == movieId);
      if (!movie) {
        return res.status(404).send('Movie not found');
      }

      // Storing the movie in cache
      redisClient.set(cacheKey, JSON.stringify(movie), 'EX', 3600); // Set an expiry time of 1 hour

      return res.json(movie);
    }
  });
});

// Write-through implementation for creating a movie
router.post('/movies', (req, res) => {
  const {
    id,
    name,
    title
  } = req.body;

  const movie = {
    id,
    name,
    title
  };
  movies.push(movie);

  const cacheKey = `${CACHE_KEY_PREFIX}${id}`;
  // Store the movie in cache
  redisClient.set(cacheKey, JSON.stringify(movie), 'EX', 3600);

  return res.status(201).json(movie);
});

// Write-through implementation for updating a movie
router.put('/movies/:id', (req, res) => {
  const movieId = req.params.id;
  const {
    name,
    title
  } = req.body;

  let movie = movies.find(m => m.id == movieId);
  if (!movie) {
    return res.status(404).send('Movie not found');
  }

  movie.name = name;
  movie.title = title;

  const cacheKey = `${CACHE_KEY_PREFIX}${movieId}`;
  // Update the movie in cache
  redisClient.set(cacheKey, JSON.stringify(movie), 'EX', 3600); // Set an expiry time of 1 hour

  return res.json(movie);
});

// Invalidate cache on movie deletion
router.delete('/movies/:id', (req, res) => {
  const movieId = req.params.id;

  movies = movies.filter(m => m.id != movieId);
  const cacheKey = `${CACHE_KEY_PREFIX}${movieId}`;
  // Remove the movie from cache
  redisClient.del(cacheKey);

  return res.status(204).send();
});

export default router;