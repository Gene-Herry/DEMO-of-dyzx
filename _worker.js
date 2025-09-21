export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // CORS 头部设置
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
        
        // 处理 OPTIONS 请求
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        
        // 处理静态文件
        if (url.pathname === '/' || !url.pathname.startsWith('/api')) {
            return env.ASSETS.fetch(request);
        }
        
        // API 健康检查
        if (url.pathname === '/api/health') {
            return new Response(JSON.stringify({ 
                status: 'ok', 
                time: new Date().toISOString(),
                hasDB: !!env.DB,
                env: Object.keys(env)
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        
        // 数据库初始化检查和创建表
        if (url.pathname === '/api/init' && request.method === 'GET') {
            try {
                if (!env.DB) {
                    throw new Error('数据库未绑定，请在 Pages 设置中绑定 D1 数据库');
                }
                
                // 创建表（如果不存在）
                await env.DB.prepare(`
                    CREATE TABLE IF NOT EXISTS records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date TEXT NOT NULL,
                        grade TEXT NOT NULL,
                        department TEXT NOT NULL,
                        content TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `).run();
                
                return new Response(JSON.stringify({ 
                    success: true, 
                    message: '数据库表创建成功' 
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ 
                    error: error.message,
                    stack: error.stack 
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 获取所有记录
        if (url.pathname === '/api/records' && request.method === 'GET') {
            try {
                // 检查数据库是否绑定
                if (!env.DB) {
                    throw new Error('数据库未绑定，请检查 D1 绑定配置');
                }
                
                // 首先尝试创建表（如果不存在）- 包含新的grade字段
                await env.DB.prepare(`
                    CREATE TABLE IF NOT EXISTS records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date TEXT NOT NULL,
                        grade TEXT NOT NULL,
                        department TEXT NOT NULL,
                        content TEXT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `).run();
                
                // 检查是否需要添加grade列（为了兼容旧数据）
                try {
                    await env.DB.prepare(`ALTER TABLE records ADD COLUMN grade TEXT`).run();
                } catch (e) {
                    // 列已存在，忽略错误
                }
                
                const result = await env.DB.prepare(
                    'SELECT * FROM records ORDER BY created_at DESC'
                ).all();
                
                return new Response(JSON.stringify({ 
                    records: result.results || [],
                    count: result.results ? result.results.length : 0
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                console.error('数据库查询错误:', error);
                return new Response(JSON.stringify({ 
                    error: error.message,
                    stack: error.stack,
                    type: 'DATABASE_ERROR'
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 添加新记录
        if (url.pathname === '/api/records' && request.method === 'POST') {
            try {
                if (!env.DB) {
                    throw new Error('数据库未绑定');
                }
                
                const data = await request.json();
                
                // 验证数据
                if (!data.date || !data.grade || !data.department || !data.content) {
                    return new Response(JSON.stringify({ 
                        error: '缺少必填字段',
                        required: ['date', 'grade', 'department', 'content'],
                        received: data 
                    }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                
                // 验证年级值
                if (!['高一', '高二'].includes(data.grade)) {
                    return new Response(JSON.stringify({ 
                        error: '年级必须是"高一"或"高二"',
                        received: data.grade 
                    }), {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }
                
                const result = await env.DB.prepare(
                    'INSERT INTO records (date, grade, department, content) VALUES (?, ?, ?, ?)'
                ).bind(data.date, data.grade, data.department, data.content).run();
                
                return new Response(JSON.stringify({ 
                    success: true, 
                    id: result.meta.last_row_id 
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ 
                    error: error.message,
                    stack: error.stack 
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 删除记录
        const deleteMatch = url.pathname.match(/^\/api\/records\/(\d+)$/);
        if (deleteMatch && request.method === 'DELETE') {
            try {
                if (!env.DB) {
                    throw new Error('数据库未绑定');
                }
                
                const id = parseInt(deleteMatch[1]);
                
                await env.DB.prepare(
                    'DELETE FROM records WHERE id = ?'
                ).bind(id).run();
                
                return new Response(JSON.stringify({ success: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ 
                    error: error.message,
                    stack: error.stack 
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 获取统计数据
        if (url.pathname === '/api/stats' && request.method === 'GET') {
            try {
                if (!env.DB) {
                    throw new Error('数据库未绑定');
                }
                
                // 总记录数
                const totalResult = await env.DB.prepare(
                    'SELECT COUNT(*) as count FROM records'
                ).first();
                
                // 今日记录数
                const today = new Date().toISOString().split('T')[0];
                const todayResult = await env.DB.prepare(
                    'SELECT COUNT(*) as count FROM records WHERE date = ?'
                ).bind(today).first();
                
                // 部门统计
                const departmentResult = await env.DB.prepare(
                    'SELECT department, COUNT(*) as count FROM records GROUP BY department'
                ).all();
                
                // 年级统计
                const gradeResult = await env.DB.prepare(
                    'SELECT grade, COUNT(*) as count FROM records WHERE grade IS NOT NULL GROUP BY grade'
                ).all();
                
                return new Response(JSON.stringify({
                    total: totalResult?.count || 0,
                    today: todayResult?.count || 0,
                    byDepartment: departmentResult.results || [],
                    byGrade: gradeResult.results || []
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({ 
                    error: error.message,
                    stack: error.stack 
                }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 404
        return new Response('Not Found', { status: 404, headers: corsHeaders });
    }
};
