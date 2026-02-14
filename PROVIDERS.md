# Hexos - Providers de LLM

O Hexos Runtime suporta múltiplos providers de LLM. Você pode escolher qual usar ao configurar cada agente.

---

## Providers Disponíveis

| Provider | Configuração | Modelos |
|----------|--------------|---------|
| **OpenAI** | `OPENAI_API_KEY` | gpt-4o, gpt-4o-mini, gpt-4-turbo |
| **Anthropic** | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514, claude-3-opus |
| **Ollama** | `OLLAMA_HOST` (default: localhost:11434) | llama3, mistral, codellama, etc |

---

## Como Configurar Cada Provider

### OpenAI

```typescript
const runtime = new AgentRuntime({
  agents: [
    {
      id: 'main',
      name: 'Assistant',
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
      systemPrompt: 'Você é um assistente útil.',
      tools: [],
    },
  ],
});
```

**Variável de ambiente:**
```bash
OPENAI_API_KEY=sk-proj-...
```

### Anthropic

```typescript
const runtime = new AgentRuntime({
  agents: [
    {
      id: 'main',
      name: 'Assistant',
      model: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
      },
      systemPrompt: 'Você é um assistente útil.',
      tools: [],
    },
  ],
});
```

**Variável de ambiente:**
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

### Ollama (Local e Gratuito)

```typescript
const runtime = new AgentRuntime({
  agents: [
    {
      id: 'main',
      name: 'Assistant',
      model: {
        provider: 'ollama',
        model: 'llama3',  // ou mistral, codellama, phi, etc
      },
      systemPrompt: 'Você é um assistente útil.',
      tools: [],
    },
  ],
});
```

**Variável de ambiente (opcional):**
```bash
OLLAMA_HOST=http://localhost:11434  # default
```

---

## Instalando e Usando Ollama

1. **Instale o Ollama:**
   - Site: https://ollama.ai
   - Mac: `brew install ollama`
   - Linux: `curl -fsSL https://ollama.ai/install.sh | sh`

2. **Baixe um modelo:**
   ```bash
   ollama pull llama3
   ollama pull mistral
   ollama pull codellama
   ```

3. **Inicie o servidor (se não estiver rodando):**
   ```bash
   ollama serve
   ```

4. **Configure seu agente:**
   ```typescript
   model: {
     provider: 'ollama',
     model: 'llama3',
   }
   ```

---

## Modelos Recomendados

### OpenAI
| Modelo | Uso |
|--------|-----|
| `gpt-4o` | Melhor qualidade, mais caro |
| `gpt-4o-mini` | Bom equilíbrio custo/qualidade |
| `gpt-4-turbo` | Contexto grande (128k) |

### Anthropic
| Modelo | Uso |
|--------|-----|
| `claude-sonnet-4-20250514` | Melhor equilíbrio |
| `claude-3-opus-20240229` | Máxima qualidade |
| `claude-3-haiku-20240307` | Mais rápido e barato |

### Ollama (Local)
| Modelo | Uso |
|--------|-----|
| `llama3` | Uso geral |
| `mistral` | Rápido e eficiente |
| `codellama` | Especializado em código |
| `phi` | Leve, roda em máquinas modestas |

---

## Trocando de Provider

Para trocar de provider, basta alterar a configuração do agente:

```typescript
// De OpenAI...
model: { provider: 'openai', model: 'gpt-4o-mini' }

// ...para Ollama (local)
model: { provider: 'ollama', model: 'llama3' }
```

O Runtime cuida de toda a adaptação de formato automaticamente.
