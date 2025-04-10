function bilibiliPlugin(ctx) {
  return {
    platform: "B站音频",
    async search(keyword) {
      const { data } = await ctx.axios.get('https://api.bilibili.com/audio/music-service-c/s', {
        params: { search_type: 'music', keyword }
      });
      return data.data.result.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.author,
        duration: track.duration
      }));
    },
    getMediaUrl(song) {
      return ctx.axios.get(`https://www.bilibili.com/audio/music-service-c/web/url?sid=${song.id}`)
        .then(res => res.data.data.cdns[0]);
    }
  };
}