const url = "https://stringpeludinha.baileys.marketcodebrasil.com.br/api/management/sse";
const token = "baileys_82695aedf07cb5c776ae8f4fc05b719be951b25e3d494d9126d215814e49838e";

console.log("🚀 Testando MCP Server SSE...\n");

// Teste 1: Listar ferramentas MCP
async function testListTools() {
    console.log("📋 Teste 1: Listando ferramentas MCP");
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                method: "tools/list",
                params: {}
            })
        });

        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        console.log("✅ Ferramentas disponíveis:", data.result.tools.length);
        console.log("🔧 Algumas ferramentas:", data.result.tools.slice(0, 5).map(t => t.name));
        console.log("");
        return data;
    } catch (error) {
        console.error("❌ Erro ao listar ferramentas:", error.message);
        console.log("");
    }
}

// Teste 2: Executar ferramenta (resposta JSON)
async function testExecuteToolJSON() {
    console.log("🎯 Teste 2: Executando list_sessions (JSON)");
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                method: "tools/call",
                params: {
                    name: "list_sessions",
                    arguments: {}
                },
                streaming: false
            })
        });

        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        console.log("✅ Resultado JSON:", data.result.content[0].text);
        console.log("");
        return data;
    } catch (error) {
        console.error("❌ Erro na execução JSON:", error.message);
        console.log("");
    }
}

// Teste 3: Executar ferramenta com streaming SSE
async function testExecuteToolSSE() {
    console.log("📡 Teste 3: Executando list_sessions (SSE Stream)");
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                method: "tools/call",
                params: {
                    name: "list_sessions",
                    arguments: {}
                },
                streaming: true
            })
        });

        if (!response.ok) throw new Error(`Erro ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let eventCount = 0;

        console.log("🔄 Recebendo eventos SSE:");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const eventData = JSON.parse(line.substring(6));
                        eventCount++;
                        console.log(`📦 Evento ${eventCount}:`, eventData);
                    } catch (e) {
                        console.log(`📦 Evento ${eventCount}:`, line);
                    }
                }
            }
        }

        console.log(`✅ Stream concluído! Recebidos ${eventCount} eventos`);
        console.log("");
    } catch (error) {
        console.error("❌ Erro no streaming SSE:", error.message);
        console.log("");
    }
}

// Teste 4: Testar ferramenta de envio de mensagem
async function testSendMessage() {
    console.log("💬 Teste 4: Testando send_message");
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                method: "tools/call",
                params: {
                    name: "send_message",
                    arguments: {
                        sessionId: "test_session",
                        jid: "5511999999999@s.whatsapp.net",
                        message: "Teste MCP SSE funcionando! 🚀"
                    }
                },
                streaming: false
            })
        });

        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const data = await response.json();
        
        if (data.error) {
            console.log("⚠️  Erro esperado (sessão não existe):", data.error.message);
        } else {
            console.log("✅ Mensagem enviada:", data.result.content[0].text);
        }
        console.log("");
    } catch (error) {
        console.error("❌ Erro ao enviar mensagem:", error.message);
        console.log("");
    }
}

// Teste 5: Testar endpoint de status
async function testStatus() {
    console.log("📊 Teste 5: Testando endpoint de status");
    try {
        const response = await fetch(url + "/status", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error(`Erro ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        console.log("🔄 Recebendo status via SSE:");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const eventData = JSON.parse(line.substring(6));
                        if (eventData.type === 'status') {
                            console.log("✅ Status do servidor:", eventData.status);
                        } else if (eventData.type === 'end') {
                            console.log("🏁 Status stream finalizado");
                        }
                    } catch (e) {
                        console.log("📦 Evento:", line);
                    }
                }
            }
        }
        console.log("");
    } catch (error) {
        console.error("❌ Erro ao obter status:", error.message);
        console.log("");
    }
}

// Executar todos os testes
async function runAllTests() {
    console.log("=" .repeat(60));
    console.log("🧪 TESTE COMPLETO DO MCP SERVER SSE");
    console.log("=" .repeat(60));
    console.log("");

    await testListTools();
    await testExecuteToolJSON();
    await testExecuteToolSSE();
    await testSendMessage();
    await testStatus();

    console.log("=" .repeat(60));
    console.log("🎉 TODOS OS TESTES CONCLUÍDOS!");
    console.log("=" .repeat(60));
}

// Executar testes
runAllTests().catch(console.error);