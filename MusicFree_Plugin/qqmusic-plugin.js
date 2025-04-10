module.exports = {
  // 插件基本信息
  platform: "QQ音乐",
  author: "Snoweer",
  version: "1.0.0",
  srcUrl: "https://your-domain.com/qqmusic-plugin.js",
  primaryKey: ["id", "mid"],
  cacheControl: "no-cache",
  hints: {
    importMusicItem: [
      "1. 支持导入QQ音乐单曲链接，如：https://y.qq.com/n/ryqq/songDetail/004Z8Ihr0JIu5s"
    ],
    importMusicSheet: [
      "1. 支持导入QQ音乐歌单链接，如：https://y.qq.com/n/ryqq/playlist/8223335694"
    ]
  },

  // 搜索功能
  async search(query, page, type) {
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    
    try {
      let result;
      switch (type) {
        case "music":
          result = await this._searchSongs(query, offset, pageSize);
          break;
        case "album":
          result = await this._searchAlbums(query, offset, pageSize);
          break;
        case "artist":
          result = await this._searchArtists(query, offset, pageSize);
          break;
        case "sheet":
          result = await this._searchPlaylists(query, offset, pageSize);
          break;
        default:
          return { isEnd: true, data: [] };
      }
      
      return {
        isEnd: result.data.length < pageSize,
        data: result.data
      };
    } catch (e) {
      console.error("搜索出错:", e);
      return { isEnd: true, data: [] };
    }
  },

  // 获取音源
  async getMediaSource(musicItem, quality) {
    try {
      // 这里需要实现获取不同音质的逻辑
      const songId = musicItem.id;
      const { url, headers } = await this._getSongUrl(songId, quality);
      
      return {
        url,
        headers: headers || {},
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      };
    } catch (e) {
      console.error("获取音源出错:", e);
      throw e;
    }
  },

  // 获取歌词
  async getLyric(musicItem) {
    try {
      const songId = musicItem.id;
      const { lrc, tlyric } = await this._getSongLyric(songId);
      
      return {
        rawLrc: lrc || "",
        translation: tlyric || ""
      };
    } catch (e) {
      console.error("获取歌词出错:", e);
      return { rawLrc: "", translation: "" };
    }
  },

  // 获取专辑详情
  async getAlbumInfo(albumItem, page) {
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    
    try {
      const albumId = albumItem.id;
      const { albumInfo, songs } = await this._getAlbumDetail(albumId, offset, pageSize);
      
      return {
        isEnd: songs.length < pageSize,
        musicList: songs,
        ...(page <= 1 ? { albumItem: albumInfo } : {})
      };
    } catch (e) {
      console.error("获取专辑详情出错:", e);
      return { isEnd: true, musicList: [] };
    }
  },

  // 获取歌单详情
  async getMusicSheetInfo(sheetItem, page) {
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    
    try {
      const playlistId = sheetItem.id;
      const { playlistInfo, songs } = await this._getPlaylistDetail(playlistId, offset, pageSize);
      
      return {
        isEnd: songs.length < pageSize,
        musicList: songs,
        ...(page <= 1 ? { sheetItem: playlistInfo } : {})
      };
    } catch (e) {
      console.error("获取歌单详情出错:", e);
      return { isEnd: true, musicList: [] };
    }
  },

  // 导入单曲
  async importMusicItem(urlLike) {
    try {
      // 解析URL或ID
      const songId = this._extractSongIdFromUrl(urlLike);
      if (!songId) {
        throw new Error("无效的QQ音乐单曲链接");
      }
      
      const songInfo = await this._getSongDetail(songId);
      return songInfo;
    } catch (e) {
      console.error("导入单曲出错:", e);
      throw e;
    }
  },

  // 导入歌单
  async importMusicSheet(urlLike) {
    try {
      // 解析URL或ID
      const playlistId = this._extractPlaylistIdFromUrl(urlLike);
      if (!playlistId) {
        throw new Error("无效的QQ音乐歌单链接");
      }
      
      const { playlistInfo, songs } = await this._getPlaylistDetail(playlistId, 0, 1000);
      return songs;
    } catch (e) {
      console.error("导入歌单出错:", e);
      throw e;
    }
  },

  // 获取榜单列表
  async getTopLists() {
    try {
      const topLists = await this._getTopListCategories();
      return topLists;
    } catch (e) {
      console.error("获取榜单列表出错:", e);
      return [];
    }
  },

  // 获取榜单详情
  async getTopListDetail(topListItem, page) {
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    
    try {
      const topId = topListItem.id;
      const { topInfo, songs } = await this._getTopListDetail(topId, offset, pageSize);
      
      return {
        isEnd: songs.length < pageSize,
        topListItem: topInfo,
        musicList: songs
      };
    } catch (e) {
      console.error("获取榜单详情出错:", e);
      return { isEnd: true, musicList: [] };
    }
  },

  // ========== 私有方法 ==========
  
  // 搜索歌曲
  async _searchSongs(query, offset, limit) {
    // 实现QQ音乐歌曲搜索API调用
    const response = await this._requestQQMusicApi("search", {
      key: query,
      type: 0, // 0-单曲
      offset,
      limit
    });
    
    return {
      data: response.data.list.map(item => ({
        id: item.songid,
        mid: item.songmid,
        title: item.songname,
        artist: item.singer.map(s => s.name).join("/"),
        album: item.albumname,
        albumId: item.albumid,
        albumMid: item.albummid,
        artwork: `https://y.qq.com/music/photo_new/T002R300x300M000${item.albummid}.jpg`,
        duration: item.interval * 1000
      }))
    };
  },

  // 搜索专辑
  async _searchAlbums(query, offset, limit) {
    // 实现QQ音乐专辑搜索API调用
    const response = await this._requestQQMusicApi("search", {
      key: query,
      type: 8, // 8-专辑
      offset,
      limit
    });
    
    return {
      data: response.data.list.map(item => ({
        id: item.albumid,
        mid: item.albummid,
        title: item.albumname,
        artist: item.singername,
        artistId: item.singerid,
        artwork: `https://y.qq.com/music/photo_new/T002R300x300M000${item.albummid}.jpg`,
        description: item.desc || ""
      }))
    };
  },

  // 搜索歌手
  async _searchArtists(query, offset, limit) {
    // 实现QQ音乐歌手搜索API调用
    const response = await this._requestQQMusicApi("search", {
      key: query,
      type: 9, // 9-歌手
      offset,
      limit
    });
    
    return {
      data: response.data.list.map(item => ({
        id: item.singerid,
        mid: item.singermid,
        name: item.singername,
        avatar: `https://y.qq.com/music/photo_new/T001R300x300M000${item.singermid}.jpg`,
        worksNum: item.songnum
      }))
    };
  },

  // 搜索歌单
  async _searchPlaylists(query, offset, limit) {
    // 实现QQ音乐歌单搜索API调用
    const response = await this._requestQQMusicApi("search", {
      key: query,
      type: 2, // 2-歌单
      offset,
      limit
    });
    
    return {
      data: response.data.list.map(item => ({
        id: item.dissid,
        title: item.dissname,
        artwork: item.imgurl,
        creator: item.creator.name,
        playCount: item.listennum,
        createTime: item.createtime
      }))
    };
  },

  // 获取歌曲URL
  async _getSongUrl(songId, quality) {
    // 实现获取歌曲播放URL的逻辑
    const qualityMap = {
      low: 128,
      standard: 192,
      high: 320,
      super: 999 // 无损
    };
    
    const response = await this._requestQQMusicApi("songUrl", {
      id: songId,
      quality: qualityMap[quality] || 192
    });
    
    return {
      url: response.data.url,
      headers: {
        Referer: "https://y.qq.com/",
        Origin: "https://y.qq.com"
      }
    };
  },

  // 获取歌词
  async _getSongLyric(songId) {
    // 实现获取歌词的逻辑
    const response = await this._requestQQMusicApi("lyric", {
      id: songId
    });
    
    return {
      lrc: response.data.lyric,
      tlyric: response.data.tlyric
    };
  },

  // 获取专辑详情
  async _getAlbumDetail(albumId, offset, limit) {
    // 实现获取专辑详情的逻辑
    const response = await this._requestQQMusicApi("albumDetail", {
      id: albumId,
      offset,
      limit
    });
    
    return {
      albumInfo: {
        id: response.data.id,
        title: response.data.name,
        artist: response.data.singer,
        artistId: response.data.singerId,
        artwork: response.data.picUrl,
        description: response.data.desc,
        publishTime: response.data.publishTime
      },
      songs: response.data.songs.map(item => ({
        id: item.id,
        mid: item.mid,
        title: item.name,
        artist: item.singer.map(s => s.name).join("/"),
        album: item.album.name,
        albumId: item.album.id,
        albumMid: item.album.mid,
        artwork: item.album.picUrl,
        duration: item.interval * 1000
      }))
    };
  },

  // 获取歌单详情
  async _getPlaylistDetail(playlistId, offset, limit) {
    // 实现获取歌单详情的逻辑
    const response = await this._requestQQMusicApi("playlistDetail", {
      id: playlistId,
      offset,
      limit
    });
    
    return {
      playlistInfo: {
        id: response.data.id,
        title: response.data.name,
        creator: response.data.creator.nickname,
        creatorId: response.data.creator.userId,
        artwork: response.data.coverImgUrl,
        playCount: response.data.playCount,
        trackCount: response.data.trackCount,
        createTime: response.data.createTime,
        description: response.data.description
      },
      songs: response.data.tracks.map(item => ({
        id: item.id,
        mid: item.mid,
        title: item.name,
        artist: item.ar.map(a => a.name).join("/"),
        album: item.al.name,
        albumId: item.al.id,
        albumMid: item.al.mid,
        artwork: item.al.picUrl,
        duration: item.dt
      }))
    };
  },

  // 获取歌曲详情
  async _getSongDetail(songId) {
    // 实现获取歌曲详情的逻辑
    const response = await this._requestQQMusicApi("songDetail", {
      id: songId
    });
    
    const item = response.data;
    return {
      id: item.id,
      mid: item.mid,
      title: item.name,
      artist: item.singer.map(s => s.name).join("/"),
      album: item.album.name,
      albumId: item.album.id,
      albumMid: item.album.mid,
      artwork: item.album.picUrl,
      duration: item.interval * 1000
    };
  },

  // 获取榜单分类
  async _getTopListCategories() {
    // 实现获取榜单分类的逻辑
    const response = await this._requestQQMusicApi("topListCategories");
    
    return response.data.map(category => ({
      title: category.name,
      data: category.list.map(item => ({
        id: item.id,
        title: item.name,
        artwork: item.picUrl,
        updateFrequency: item.updateFrequency
      }))
    }));
  },

  // 获取榜单详情
  async _getTopListDetail(topId, offset, limit) {
    // 实现获取榜单详情的逻辑
    const response = await this._requestQQMusicApi("topListDetail", {
      id: topId,
      offset,
      limit
    });
    
    return {
      topInfo: {
        id: response.data.id,
        title: response.data.name,
        artwork: response.data.picUrl,
        updateTime: response.data.updateTime,
        updateFrequency: response.data.updateFrequency,
        description: response.data.description
      },
      songs: response.data.songs.map(item => ({
        id: item.id,
        mid: item.mid,
        title: item.name,
        artist: item.ar.map(a => a.name).join("/"),
        album: item.al.name,
        albumId: item.al.id,
        albumMid: item.al.mid,
        artwork: item.al.picUrl,
        duration: item.dt
      }))
    };
  },

  // 从URL提取歌曲ID
  _extractSongIdFromUrl(urlLike) {
    const pattern = /song\/(\w+)/;
    const match = urlLike.match(pattern);
    return match ? match[1] : urlLike;
  },

  // 从URL提取歌单ID
  _extractPlaylistIdFromUrl(urlLike) {
    const pattern = /playlist\/(\w+)/;
    const match = urlLike.match(pattern);
    return match ? match[1] : urlLike;
  },

  // QQ音乐API请求
  async _requestQQMusicApi(endpoint, params = {}) {
    const baseUrl = "https://c.y.qq.com";
    const headers = {
      Referer: "https://y.qq.com/",
      Origin: "https://y.qq.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    };
    
    const url = `${baseUrl}/${endpoint}?${new URLSearchParams(params)}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`QQ音乐API请求失败: ${response.status}`);
    }
    
    return response.json();
  }
};