const url = "https://stringpeludinha.baileys.marketcodebrasil.com.br/api/baileys/mcp/execute";

fetch(url, {
    method: "GET",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer baileys_bfb6840d7d76d450102450834248daf6f85cd33761bd074987f3b9bd016df96f"
    }
})
    .then(response => {
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log("🔥 Dados recebidos da MCP:", data);
    })
    .catch(error => {
        console.error("💥 Deu ruim na conexão:", error.message);
    });
