function qqPlugin(ctx) {
  return {
    platform: "QQ音乐",
    version: "1.0.0",
    async search(keyword) {
      const { data } = await ctx.axios.get('https://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp', {
        params: { w: keyword, format: 'json' }
      });
      return data.data.song.list.map(song => ({
        id: song.songid,
        title: song.songname,
        artist: song.singer[0].name
      }));
    }
  };
}