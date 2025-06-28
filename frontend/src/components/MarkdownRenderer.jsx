import 'highlight.js/styles/github.css'; // Estilo para syntax highlighting
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

// Componentes customizados para elementos markdown
const MarkdownComponents = {
  // Código inline
  code: ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');

    if (inline) {
      return (
        <code
          className="px-1.5 py-0.5 bg-gray-100 text-red-600 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div className="my-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          {match && (
            <div className="bg-gray-100 px-3 py-2 border-b border-gray-200 text-xs font-medium text-gray-600">
              {match[1]}
            </div>
          )}
          <pre className="p-4 overflow-x-auto">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      </div>
    );
  },

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 text-gray-700 italic">
      {children}
    </blockquote>
  ),

  // Tabelas
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,

  th: ({ children }) => (
    <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b border-gray-200">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
      {children}
    </td>
  ),

  // Links
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline"
    >
      {children}
    </a>
  ),

  // Listas
  ul: ({ children }) => (
    <ul className="list-disc list-inside my-2 space-y-1 text-gray-700">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="list-decimal list-inside my-2 space-y-1 text-gray-700">
      {children}
    </ol>
  ),

  li: ({ children }) => <li className="ml-2">{children}</li>,

  // Cabeçalhos
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-gray-900 my-4 border-b border-gray-200 pb-2">
      {children}
    </h1>
  ),

  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-gray-900 my-3">{children}</h2>
  ),

  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-gray-900 my-2">{children}</h3>
  ),

  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-gray-900 my-2">{children}</h4>
  ),

  // Parágrafos
  p: ({ children }) => (
    <p className="text-gray-700 my-2 leading-relaxed">{children}</p>
  ),

  // Texto em negrito
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),

  // Texto em itálico
  em: ({ children }) => <em className="italic text-gray-700">{children}</em>,

  // Separadores
  hr: () => <hr className="my-6 border-gray-200" />,

  // Imagens com suporte a base64
  img: ({ src, alt, title }) => {
    // Verificar se é uma imagem base64
    const isBase64 = src?.startsWith('data:image/');
    
    return (
      <div className="my-4 flex justify-center">
        <img
          src={src}
          alt={alt || 'Imagem'}
          title={title}
          className="max-w-full h-auto rounded-lg shadow-md border border-gray-200"
          style={{ maxHeight: '500px' }}
          onError={(e) => {
            e.target.style.display = 'none';
            // Mostrar placeholder em caso de erro
            const placeholder = document.createElement('div');
            placeholder.className = 'flex items-center justify-center w-full h-32 bg-gray-100 border border-gray-300 rounded-lg';
            placeholder.innerHTML = `
              <div class="text-center text-gray-500">
                <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <p class="text-sm">Erro ao carregar imagem</p>
              </div>
            `;
            e.target.parentNode.replaceChild(placeholder, e.target);
          }}
          loading="lazy"
        />
      </div>
    );
  },
};

export default function MarkdownRenderer({ content, className = '' }) {
  // Função para processar imagens base64 no conteúdo
  const processBase64Images = (text) => {
    // Regex para encontrar imagens base64 em markdown
    const base64ImageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g;
    
    return text.replace(base64ImageRegex, (match, alt, src) => {
      // Gerar um ID único para cada imagem
      const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Retornar HTML customizado para a imagem
      return `<div class="my-4 flex justify-center">
        <img 
          id="${imageId}"
          src="${src}" 
          alt="${alt || 'Imagem'}" 
          class="max-w-full h-auto rounded-lg shadow-md border border-gray-200"
          style="max-height: 500px;"
          loading="lazy"
          onerror="this.style.display='none'; this.parentNode.innerHTML='<div class=\\'flex items-center justify-center w-full h-32 bg-gray-100 border border-gray-300 rounded-lg\\'><div class=\\'text-center text-gray-500\\'><svg class=\\'w-8 h-8 mx-auto mb-2\\' fill=\\'none\\' stroke=\\'currentColor\\' viewBox=\\'0 0 24 24\\'><path stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'2\\' d=\\'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\\'></path></svg><p class=\\'text-sm\\'>Erro ao carregar imagem</p></div></div>';"
        />
      </div>`;
    });
  };

  // Processar o conteúdo antes de passar para o ReactMarkdown
  const processedContent = processBase64Images(content);

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={MarkdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

// Componente para highlighting de code específico do FlowChat API
export function FlowChatCodeBlock({ code, language = 'javascript' }) {
  return (
    <div className="my-4">
      <div className="bg-gray-900 text-white rounded-lg overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 text-xs font-medium text-gray-300 border-b border-gray-700">
          FlowChat API - {language}
        </div>
        <pre className="p-4 overflow-x-auto">
          <code className={`language-${language}`}>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// Componente para destacar respostas de tools/actions
export function ToolResponseBlock({ toolName, result, success = true }) {
  const bgColor = success ? 'bg-green-50' : 'bg-red-50';
  const borderColor = success ? 'border-green-200' : 'border-red-200';
  const textColor = success ? 'text-green-800' : 'text-red-800';
  const iconColor = success ? 'text-green-600' : 'text-red-600';

  return (
    <div className={`my-3 p-3 rounded-lg border ${bgColor} ${borderColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full ${
            success ? 'bg-green-500' : 'bg-red-500'
          }`}
        ></div>
        <span className={`text-sm font-medium ${textColor}`}>{toolName}</span>
      </div>
      <div className="text-sm text-gray-700">
        <MarkdownRenderer
          content={
            typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2)
          }
        />
      </div>
    </div>
  );
}
