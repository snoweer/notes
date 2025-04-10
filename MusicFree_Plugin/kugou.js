function kugouPlugin(ctx) {
  return {
    platform: "酷狗音乐",
    async search(keyword) {
      const { data } = await ctx.axios.get('http://mobilecdn.kugou.com/api/v3/search/song', {
        params: { keyword, page: 1 }
      });
      return data.data.info.map(song => ({
        id: song.hash,
        title: song.songname,
        artist: song.singername,
        duration: song.duration
      }));
    },
    getMediaUrl(song) {
      return `http://m.kugou.com/app/i/getSongInfo.php?hash=${song.id}`;
    }
  };
}