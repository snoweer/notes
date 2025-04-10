function ytmusicPlugin(ctx) {
  return {
    platform: "YouTube音乐",
    async search(keyword) {
      const { data } = await ctx.axios.get('https://yt.lemnoslife.com/search', {
        params: { q: keyword, part: 'snippet' }
      });
      return data.items
        .filter(item => item.id.kind === 'youtube#video')
        .map(video => ({
          id: video.id.videoId,
          title: video.snippet.title,
          artist: video.snippet.channelTitle,
          duration: 0 // 需额外解析
        }));
    },
    getMediaUrl(song) {
      return `https://www.youtube.com/watch?v=${song.id}`;
    }
  };
}