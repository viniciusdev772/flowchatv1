import asyncio
from dotenv import load_dotenv
load_dotenv()
from browser_use import Agent
from browser_use.llm import ChatOpenAI

async def main():
    agent = Agent(
        use_vision=True,
        task="ACESSE O SITE URL de acesso: https://fast-radiant-9710.n8n.marketcodebrasil.com.br e FAÇA LOGIN COM O USUÁRIO:vinil6006@gmail.com E SENHA: ner9@e60Xb70c*pK, e sem seguida crie um novo workflow no N8N com o nome 'Teste' e adicione um nó de gatilho HTTP.",
        llm=ChatOpenAI(model="gpt-4o", temperature=1.0),
    )
    await agent.run()

asyncio.run(main())