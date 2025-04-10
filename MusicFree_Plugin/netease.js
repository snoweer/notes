function neteasePlugin(ctx) {
  return {
    platform: "网易云音乐",
    version: "1.0.1",
    async search(keyword) {
      const { data } = await ctx.axios.post('https://music.163.com/api/search/get', {
        s: keyword, type: 1, offset: 0
      }, { headers: { 'X-Real-IP': '116.25.146.177' } });
      return data.result.songs.map(song => ({
        id: song.id,
        title: song.name,
        artist: song.artists[0].name,
        duration: song.duration / 1000
      }));
    },
    getMediaUrl(song) {
      return `https://music.163.com/song/media/outer/url?id=${song.id}.mp3`;
    }
  };
}