// Cloudflare Workers（API主入口）最新版兼容
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 仅处理 API 路径
    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request);
    }

    // 其它API可以拓展...

    // 所有未命中路径返回404
    return new Response('Not found', {status:404});
  }
};

// 简单账号密码清单，明文无加密（仅演示！）
const ACCOUNTS = {
  "demo1": "1234",
  "demo2": "1234"
};

// 登录校验API
async function handleLogin(request) {
  try {
    const {username, password} = await request.json();
    // 校验
    if (username in ACCOUNTS && ACCOUNTS[username] === password) {
      return Response.json({ok:true, username});
    } else {
      return Response.json({ok:false, error:"账号或密码错误"});
    }
  } catch {
    return Response.json({ok:false, error:"参数错误"});
  }
}
