function spotifyPlugin(ctx) {
  return {
    platform: "Spotify",
    async search(keyword) {
      const { data } = await ctx.axios.get('https://api.spotify.com/v1/search', {
        params: { q: keyword, type: 'track' },
        headers: { Authorization: 'Bearer [YOUR_CLIENT_TOKEN]' }
      });
      return data.tracks.items.map(track => ({
        id: track.id,
        title: track.name,
        artist: track.artists[0].name,
        duration: track.duration_ms / 1000
      }));
    },
    getMediaUrl(song) {
      return song.preview_url; // 30秒试听片段
    }
  };
}