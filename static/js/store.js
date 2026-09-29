// 数据存储层。现在只存浏览器本地（localStorage）；以后上线后端时，
// 实现一个同样接口（load / save）的 RemoteStore 替换掉即可，其他代码不用改。

const PREFIX = 'guitar12:';

export class LocalStore {
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  save(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* 存储满或被禁用时忽略 */
    }
  }
}

// 以后接后端的样子（示意，还没启用）：
// export class RemoteStore {
//   constructor(baseUrl, token) { ... }
//   load(key, fallback) { 先返回本地缓存，同时后台 GET /api/data/:key 刷新 }
//   save(key, value) { 写本地缓存，并 PUT /api/data/:key 同步到服务器 }
// }

export const store = new LocalStore();
