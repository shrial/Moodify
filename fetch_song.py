import requests
import base64
import time
import oracledb

# ==== CONFIG ====
client_id = "34819ee942a34b778235f910ad89628e"
client_secret = "fcc733dc551a42389fa4a42388345175"

username = "c##moodify"
password = "moodify"
dsn = "localhost:1522/XE"

moods = ["happy", "sad", "motivated", "calm"]
limit_per_mood = 10
# ===============

def get_token(client_id, client_secret):
    auth_str = f"{client_id}:{client_secret}"
    auth_bytes = auth_str.encode("utf-8")
    auth_base64 = base64.b64encode(auth_bytes).decode("utf-8")

    headers = {
        "Authorization": f"Basic {auth_base64}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {"grant_type": "client_credentials"}
    response = requests.post("https://accounts.spotify.com/api/token", headers=headers, data=data)
    response.raise_for_status()
    return response.json()["access_token"]

def fetch_songs_by_mood(mood, token, limit=10):
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "q": mood,
        "type": "track",
        "limit": limit
    }

    url = "https://api.spotify.com/v1/search"

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        print(f"⚠️ HTTP error for mood '{mood}': {e}")
        if response.status_code == 502:
            print("🔁 Retrying in 5 seconds...")
            time.sleep(5)
            return fetch_songs_by_mood(mood, token, limit)
        else:
            return []

    items = response.json().get("tracks", {}).get("items", [])
    songs = []
    for item in items:
        song_name = item["name"]
        artist_name = item["artists"][0]["name"]
        spotify_url = item["external_urls"]["spotify"]
        songs.append((song_name, artist_name, mood, spotify_url))
    return songs

def insert_songs_to_db(songs):
    print("Connecting to Oracle DB...")
    connection = oracledb.connect(user=username, password=password, dsn=dsn)
    print("Connected.")

    cursor = connection.cursor()

    for song in songs:
        print(f"Inserting: {song}")
        try:
            cursor.execute("""
                INSERT INTO songs (song_name, artist_name, mood, spotify_url)
                VALUES (:1, :2, :3, :4)
            """, song)
            connection.commit()
            print("✅ Inserted:", song[0])
        except Exception as e:
            print(f"❌ Skipping (maybe duplicate or error): {song} -> {e}")


    cursor.close()
    connection.close()

def main():
    token = get_token(client_id, client_secret)
    for mood in moods:
        print(f"\n🎧 Fetching songs for mood: {mood}")
        songs = fetch_songs_by_mood(mood, token, limit_per_mood)
        print(f"Fetched {len(songs)} songs for mood: {mood}")
        if songs:
            print("Sample songs fetched:")
            for s in songs[:3]:
                print(s)
        insert_songs_to_db(songs)
        time.sleep(3)  # Wait 3 seconds between API calls

if __name__ == "__main__":
    main()
