const express = require("express");
const bodyParser = require("body-parser");
const oracledb = require("oracledb");
const path = require("path");
const cors = require('cors');
const app = express();
app.use(cors()); // Allow all domains, you can restrict it to specific domains
app.use(express.json()); 
//const oracledb = require("oracledb");

// Define Oracle DB connection configuration
const dbConfig = {
  user: "c##moodify",
  password: "moodify",
connectString: "localhost:1522/XE" // or replace with your actual connect string
};
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// Serve login and signup pages
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "signup.html"));
});

// Oracle DB Connection
async function connectDB() {
    return await oracledb.getConnection({
        user: "C##MOODIFY",
        password: "moodify",
        connectString: "localhost:1522/XE"
    });
}

// LOGIN
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const connection = await connectDB();
      const result = await connection.execute(
        `SELECT * FROM users WHERE username = :username AND password = :password`,
        { username, password }
      );
      await connection.close();
  
      if (result.rows.length > 0) {
        res.json({ message: "Login successful!", username });
      } else {
        res.status(401).json({ message: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Error logging in." });
    }
  });
  
  // SIGNUP
  app.post("/register", async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const connection = await connectDB();
        const insertQuery = `
            INSERT INTO users (username, email, password)
            VALUES (:username, :email, :password)
        `;

        const result = await connection.execute(insertQuery, {
            username, email, password
        }, { autoCommit: true });

        await connection.close();

        if (result.rowsAffected === 1) {
            res.status(200).json({ message: "Signup successful!" });
        } else {
            res.status(400).json({ message: "Failed to create account." });
        }

    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Server error during signup.", error: error.message });
    }
});
// ADD MOVIE
app.post('/addMovie', async (req, res) => {
    const { movie_name, year_of_release, genre } = req.body;

    try {
        const connection = await connectDB();
        await connection.execute(
            `INSERT INTO movies (MOVIE_NAME, YEAR_OF_RELEASE, GENRE) 
             VALUES (:movie_name, :year_of_release, :genre)`,
            { movie_name, year_of_release, genre },
            { autoCommit: true }
        );
        await connection.close();
        res.status(200).send('Movie added to database successfully!');
    } catch (error) {
        console.error('Error inserting movie:', error);
        res.status(500).send('Error inserting movie into database');
    }
});


// GET MOVIES BY GENRE
app.get("/getMovies", async (req, res) => {
    const genre = req.query.genre;
    if (!genre) return res.status(400).json({ message: "Genre is required" });

    try {
        const connection = await connectDB();
        const result = await connection.execute(
            `SELECT movie_name, year_of_release, genre FROM movies 
             WHERE LOWER(genre) = :genre`,
            [genre.toLowerCase()]
        );
        await connection.close();

        const movies = result.rows.map(row => ({
            movie_name: row[0],
            year_of_release: row[1],
            genre: row[2]
        }));
        res.json(movies);
    } catch (error) {
        console.error("Error fetching movies:", error);
        res.status(500).json({ message: "Failed to fetch movies." });
    }
});

// LIKE A MOVIE
app.post("/likeMovie", async (req, res) => {
    let { username, movie_name, year_of_release, genre } = req.body;

    // Debug log
    console.log("Trying to insert:", req.body);

    // Convert year_of_release to number
    year_of_release = Number(year_of_release);

    // Guard against bad inputs
    if (!username || !movie_name || isNaN(year_of_release) || !genre) {
        return res.status(400).json({ message: "Invalid input. Please provide username, movie_name, year_of_release (number), and genre." });
    }

    try {
        const connection = await connectDB();

        // Debug log to see the query being executed
        const insertMovieQuery = `
            INSERT INTO movies (movie_name, year_of_release, genre)
            VALUES (:movie_name, :year_of_release, :genre)
            ON DUPLICATE KEY UPDATE MOVIE_NAME = MOVIE_NAME;
        `;
        console.log("Executing insert query for movies:", insertMovieQuery);

        // Insert movie into movies table
        await connection.execute(insertMovieQuery, {
            movie_name,
            year_of_release,
            genre
        }, { autoCommit: true });

        // Now, insert into likedmovies table
        const insertQuery = `
            INSERT INTO likedmovies (username, movie_name, year_of_release, genre)
            VALUES (:username, :movie_name, :year_of_release, :genre)
        `;
        console.log("Executing insert query for likedmovies:", insertQuery);

        const result = await connection.execute(insertQuery, {
            username,
            movie_name,
            year_of_release,
            genre
        }, { autoCommit: true });

        await connection.close();

        // Check if rows were affected (movie inserted)
        if (result.rowsAffected === 1) {
            res.status(200).json({ message: "Movie added to liked list!" });
        } else {
            res.status(400).json({ message: "Failed to add movie." });
        }

    } catch (error) {
        console.error("Error adding liked movie:", error);
        res.status(500).json({ message: "Server error during movie like.", error: error.message });
    }
});

// GET LIKED MOVIES
app.get("/getLikedMovies", async (req, res) => {
    const userId = req.query.user_id;

    try {
        const connection = await connectDB();

        let query;
        let params = [];

        if (userId) {
            query = `SELECT username, movie_name, year_of_release, genre FROM likedmovies WHERE user_id = :user_id`;
            params = [userId];
        } else {
            query = `SELECT username, movie_name, year_of_release, genre FROM likedmovies`;
        }

        const result = await connection.execute(query, params);
        await connection.close();

        const likedMovies = result.rows.map(row => ({
            username: row[0],
            movie_name: row[1],
            year_of_release: row[2],
            genre: row[3]
        }));

        res.json(likedMovies);
    } catch (error) {
        console.error("Error fetching liked movies:", error);
        res.status(500).json({ message: "Failed to fetch liked movies." });
    }
});
// REMOVE LIKED MOVIE
app.post('/removeLikedMovie', async (req, res) => {
    const { username, movie_name, year_of_release } = req.body;
    if (!username || !movie_name || !year_of_release) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    try {
        await connection.execute(
            `INSERT INTO likedmovies (USERNAME, MOVIE_NAME, YEAR_OF_RELEASE, GENRE)
             VALUES (:username, :movie_name, :year_of_release, :genre)`,
            {
              username: movie.user_id,
              movie_name: movie.movie_name,
              year_of_release: parseInt(movie.year_of_release),
              genre: movie.genre
            },
            { autoCommit: true }
          );
        await connection.close();
        res.status(200).json({ message: "Liked movie removed successfully." });
    } catch (error) {
        console.error("Error removing liked movie:", error);
        res.status(500).json({ message: "Failed to remove liked movie." });
    }
});

app.post("/saveLikedMovies", async (req, res) => {
  const movies = req.body; // Array of liked movie objects

  try {
    const connection = await oracledb.getConnection(dbConfig);

    for (let movie of movies) {
      console.log("Trying to insert:", movie);

      await connection.execute(
        `INSERT INTO likedmovies (USERNAME, MOVIE_NAME, YEAR_OF_RELEASE, GENRE)
         VALUES (:username, :movie_name, :year_of_release, :genre)`,
        {
          username: movie.user_id,
          movie_name: movie.movie_name,
          year_of_release: parseInt(movie.year_of_release),
          genre: movie.genre
        },
        { autoCommit: true }
      );
    }

    res.send("Movies saved to database!");
  } catch (error) {
    console.error("Failed to save to database:", error);
    res.status(500).send("Failed to save to database");
  }
});

app.post("/likeSong", async (req, res) => {
    let { username, song_name, artist_name, genre, year_of_release } = req.body;

    // Debug log
    console.log("Trying to insert:", req.body);

    // Convert year_of_release to number
    year_of_release = Number(year_of_release);

    // Guard against bad inputs
    if (!username || !song_name || !artist_name || isNaN(year_of_release) || !genre) {
        return res.status(400).json({ message: "Invalid input. Please provide username, song_name, artist_name, year_of_release (number), and genre." });
    }

    try {
        const connection = await connectDB();

        // Debug log to see the query being executed
        const insertSongQuery = `
            INSERT INTO songs (song_name, artist_name, year_of_release, genre)
            VALUES (:song_name, :artist_name, :year_of_release, :genre)
            ON DUPLICATE KEY UPDATE SONG_NAME = SONG_NAME;
        `;
        console.log("Executing insert query for songs:", insertSongQuery);

        // Insert song into songs table
        await connection.execute(insertSongQuery, {
            song_name,
            artist_name,
            year_of_release,
            genre
        }, { autoCommit: true });

        // Now, insert into likedsongs table
        const insertLikedSongQuery = `
            INSERT INTO likedsongs (username, song_name, artist_name, year_of_release, genre)
            VALUES (:username, :song_name, :artist_name, :year_of_release, :genre)
        `;
        console.log("Executing insert query for likedsongs:", insertLikedSongQuery);

        const result = await connection.execute(insertLikedSongQuery, {
            username,
            song_name,
            artist_name,
            year_of_release,
            genre
        }, { autoCommit: true });

        await connection.close();

        // Check if rows were affected (song inserted)
        if (result.rowsAffected === 1) {
            res.status(200).json({ message: "Song added to liked list!" });
        } else {
            res.status(400).json({ message: "Failed to add song." });
        }

    } catch (error) {
        console.error("Error adding liked song:", error);
        res.status(500).json({ message: "Server error during song like.", error: error.message });
    }
});


// ADD LIKED SONG
// ADD LIKED SONG
app.post('/addLikedSong', async (req, res) => {
    const { user_id, song_name, artist_name, mood } = req.body;

    // Check if all necessary fields are provided
    if (!user_id || !song_name || !artist_name || !mood) {
        return res.status(400).json({ message: "All fields are required." });
    }

    try {
        const connection = await connectDB();
        try {
            await connection.execute(
              `INSERT INTO likedSongs (user_id, song_name, artist_name, mood)
               VALUES (:user_id, :song_name, :artist_name, :mood)`,
              { user_id, song_name, artist_name, mood },
              { autoCommit: true }
            );
            console.log("Insertion successful");
          } catch (err) {
            console.error("Error inserting liked song:", err);
          }
          
        await connection.close();
        res.status(200).send("Liked song added successfully.");
    } catch (err) {
        console.error("Error adding liked song:", err);
        res.status(500).send("Error adding liked song.");
    }
    console.log(req.body);  // Add this in the '/addLikedSong' endpoint

});

// REMOVE LIKED SONG
app.post('/removeLikedSong', async (req, res) => {
    const { user_id, song_name, artist_name } = req.body;

    try {
        const connection = await oracledb.getConnection(dbConfig); // Using the dbConfig as per your setup
        await connection.execute(
            `DELETE FROM likedsongs 
             WHERE username = :user_id 
               AND song_name = :song_name 
               AND artist_name = :artist_name`,
            { user_id, song_name, artist_name },
            { autoCommit: true }
        );
        await connection.close();
        res.status(200).send("Liked song removed successfully.");
    } catch (err) {
        console.error("Error removing liked song:", err);
        res.status(500).send("Error removing liked song.");
    }
});


// GET SONGS BY MOOD
app.get("/getSongs", async (req, res) => {
    const mood = req.query.mood;
    if (!mood) return res.status(400).json({ message: "Mood is required" });

    try {
        const connection = await connectDB();
        const result = await connection.execute(
            `SELECT song_name, artist_name, mood, spotify_url 
             FROM SONGS WHERE LOWER(MOOD) = :mood`,
            { mood: mood.toLowerCase() }
        );
        
        await connection.close();

        const songs = result.rows.map(row => ({
            song_name: row[0],
            artist_name: row[1],
            mood: row[2],
            spotify_url: row[3] || ""  // Make sure to handle if there's no URL
        }));

        res.json(songs);

    } catch (error) {
        console.error("Error fetching songs:", error);
        res.status(500).json({ message: "Failed to fetch songs." });
    }
});
app.post("/saveLikedSongs", async (req, res) => {
    const songs = req.body; // Array of liked song objects

    try {
        const connection = await oracledb.getConnection(dbConfig);

        for (let song of songs) {
            console.log("Trying to insert:", song);

            // Insert into database
            await connection.execute(
                `INSERT INTO likedsongs (username, song_name, artist_name, mood)
                 VALUES (:username, :song_name, :artist_name, :mood)`,
                {
                    username: song.user_id,
                    song_name: song.song_name,
                    artist_name: song.artist_name,
                    mood: song.mood
                },
                { autoCommit: true }
            );
        }

        res.send("Songs saved to liked list!");
    } catch (error) {
        console.error("Failed to save to database:", error);
        res.status(500).send("Failed to save songs to liked list");
    }
});



// GET QUOTE BY MOOD
app.get('/getRandomQuote', async (req, res) => {
    const mood = req.query.mood || 'happy';

    try {
        const connection = await connectDB();
        const result = await connection.execute(
            `SELECT quote FROM quotes WHERE LOWER(mood) = :mood`,
            { mood: mood.toLowerCase() }
        );
        
        
        await connection.close();

        if (result.rows.length > 0) {
            res.json({ quote: result.rows[0][0] });
        } else {
            res.json({ quote: "Music is the universal language of mankind." });
        }

    } catch (error) {
        console.error("Error fetching quote:", error);
        res.status(500).json({ message: "Failed to fetch quote." });
    }
});
  
// ADD LIKED SONG
// Endpoint to handle liking a song and updating mood counts
app.post('/likeSong', async (req, res) => {
    const { username, songId, mood } = req.body;
  
    // Check if all required data is provided
    if (!username || !songId || !mood) {
      return res.status(400).json({ error: "Missing required fields" });
    }
  
    try {
      // Find the user in the database (assuming you have a User collection)
      const user = await User.findOne({ username: username });
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
  
      // Increment the mood count based on the mood selected
      switch (mood.toLowerCase()) {
        case "happy":
          user.moodCounts.happy += 1;
          break;
        case "sad":
          user.moodCounts.sad += 1;
          break;
        case "motivated":
          user.moodCounts.motivated += 1;
          break;
        case "calm":
          user.moodCounts.calm += 1;
          break;
        default:
          return res.status(400).json({ error: "Invalid mood" });
      }
  
      // Save the updated user data
      await user.save();
  
      // Send back a success response
      res.status(200).json({ message: "Mood count updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "An error occurred while updating mood count" });
    }
  });

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});