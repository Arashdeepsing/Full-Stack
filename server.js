import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import {
    createClient
} from 'redis';
import 'dotenv/config';

const app = express();
const port = 3000;

// MongoDB connection
async function connectToDatabase() {
    const uri = process.env.MONGOURI;

    if (!uri) {
        throw new Error("Missing MONGOURI environment variable");
    }

    await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
}

const movieSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    director: {
        type: String,
        required: true
    },
    genre: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

const Movie = mongoose.model('Movie', movieSchema);

// Redis client setup
let redisClient;
(async () => {
    redisClient = createClient();

    redisClient.on('error', (error) => console.error(`Error : ${error}`));

    await redisClient.connect();
})();

app.use(bodyParser.json());

// GET /movies: Get the first 10 Movies
app.get('/movies', async (req, res) => {
    try {
        const cacheResults = await redisClient.get('movies');
        if (cacheResults) {
            return res.json(JSON.parse(cacheResults));
        }

        const movies = await Movie.find().limit(10).select('_id title');
        await redisClient.set('movies', JSON.stringify(movies), {
            EX: 60
        });
        res.json(movies);
    } catch (err) {
        res.status(500).send(err);
    }
});

// GET /movie/:id: Get one Movie by its ID
app.get('/movie/:id', async (req, res) => {
    try {
        const cacheResult = await redisClient.get(`movie:${req.params.id}`);
        if (cacheResult) {
            return res.json(JSON.parse(cacheResult));
        }

        const movie = await Movie.findById(req.params.id).select('_id title');
        if (movie) {
            await redisClient.set(`movie:${req.params.id}`, JSON.stringify(movie), {
                EX: 60
            });
            res.json(movie);
        } else {
            res.status(404).send('Movie not found');
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// PATCH /movie/:id: Update one Movie's title by its ID
app.patch('/movie/:id', async (req, res) => {
    try {
        const movie = await Movie.findByIdAndUpdate(
            req.params.id, {
                title: req.body.title
            }, {
                new: true
            }
        ).select('_id title');
        if (movie) {
            await redisClient.set(`movie:${req.params.id}`, JSON.stringify(movie), {
                EX: 60
            });
            res.json(movie);
        } else {
            res.status(404).send('Movie not found');
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// DELETE /movie/:id: Delete a movie by its ID
app.delete('/movie/:id', async (req, res) => {
    try {
        const movie = await Movie.findByIdAndDelete(req.params.id);
        if (movie) {
            await redisClient.del(`movie:${req.params.id}`);
            res.send('Movie deleted');
        } else {
            res.status(404).send('Movie not found');
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

app.listen(port, async () => {
    await connectToDatabase();
    console.log(`Server is running on http://localhost:${port}`);
});