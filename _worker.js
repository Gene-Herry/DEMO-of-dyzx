export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // 处理静态文件
        if (url.pathname === '/' || !url.pathname.startsWith('/api')) {
            return env.ASSETS.fetch(request);
        }
        
        // API 路由
        if (url.pathname === '/api/health') {
            return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 获取所有记录
        if (url.pathname === '/api/records' && request.method === 'GET') {
            try {
                const result = await env.DB.prepare(
                    'SELECT * FROM records ORDER BY created_at DESC'
                ).all();
                
                return new Response(JSON.stringify({ records: result.results }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 添加新记录
        if (url.pathname === '/api/records' && request.method === 'POST') {
            try {
                const data = await request.json();
                
                // 验证数据
                if (!data.date || !data.department || !data.content) {
                    return new Response(JSON.stringify({ error: '缺少必填字段' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                
                const result = await env.DB.prepare(
                    'INSERT INTO records (date, department, content) VALUES (?, ?, ?)'
                ).bind(data.date, data.department, data.content).run();
                
                return new Response(JSON.stringify({ 
                    success: true, 
                    id: result.meta.last_row_id 
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 删除记录
        const deleteMatch = url.pathname.match(/^\/api\/records\/(\d+)$/);
        if (deleteMatch && request.method === 'DELETE') {
            try {
                const id = parseInt(deleteMatch[1]);
                
                await env.DB.prepare(
                    'DELETE FROM records WHERE id = ?'
                ).bind(id).run();
                
                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 404
        return new Response('Not Found', { status: 404 });
    }
};
