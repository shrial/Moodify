import requests
import oracledb

# TMDb API key
API_KEY = "976ec65025edc3787d818c5230c438a6"

# Genre mapping to TMDb genre IDs
GENRE_IDS = {
    "romance": 10749,
    "thriller": 53,
    "drama": 18,
    "sci-fi": 878
}

# Oracle DB config
db_config = {
    "user": "c##moodify",
    "password": "moodify",
    "dsn": "localhost:1522/XE"
}

def fetch_movies_by_genre(genre_name, count=10):
    genre_id = GENRE_IDS.get(genre_name.lower())
    if not genre_id:
        print(f"❌ Genre {genre_name} not found.")
        return []

    url = "https://api.themoviedb.org/3/discover/movie"
    params = {
        "api_key": API_KEY,
        "with_genres": genre_id,
        "sort_by": "popularity.desc",
        "language": "en-US",
        "page": 1
    }

    response = requests.get(url, params=params)
    data = response.json()

    movies = []
    for movie in data.get("results", [])[:count]:
        release_date = movie.get("release_date", "")
        year = int(release_date[:4]) if release_date else 0

        movies.append({
            "movie_name": movie.get("title"),
            "year_of_release": year,
            "genre": genre_name
        })
    
    print(f"✅ Fetched {len(movies)} movies for genre '{genre_name}'")
    return movies

def insert_movies_to_db(movies):
    try:
        conn = oracledb.connect(**db_config)
        cursor = conn.cursor()
        conn.autocommit = True

        for movie in movies:
            try:
                print(f"📥 Inserting: {movie['movie_name']} ({movie['year_of_release']}) [{movie['genre']}]")
                cursor.execute("""
                    INSERT INTO movies (movie_name, year_of_release, genre)
                    VALUES (:1, :2, :3)
                """, (movie["movie_name"], movie["year_of_release"], movie["genre"]))
            except Exception as e:
                print(f"⚠️ Error inserting '{movie['movie_name']}': {e}")
        
        conn.commit()
        print("🎉 All movies inserted successfully!")
    except Exception as e:
        print("❌ DB Error:", e)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    all_movies = []
    for genre in GENRE_IDS:
        movies = fetch_movies_by_genre(genre, count=10)
        all_movies.extend(movies)

    insert_movies_to_db(all_movies)
