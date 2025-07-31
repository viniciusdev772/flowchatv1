import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowPathIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CodeBracketIcon,
  CogIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  MinusIcon,
  NoSymbolIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  Squares2X2Icon,
  TrashIcon,
  UserGroupIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

// Draggable Field Component
function DraggableField({
  field,
  isInSelected = false,
  isDragOverlay = false,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: {
      type: 'field',
      field,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        touchAction: 'manipulation',
      }}
      {...attributes}
      {...listeners}
      className={`
        bg-white border rounded-lg p-3 cursor-grab select-none touch-manipulation
        ${isDragging ? 'opacity-50' : ''}
        ${
          isInSelected
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 active:border-gray-500'
        }
        active:cursor-grabbing active:scale-[1.02] transition-transform
      `}
    >
      <div className="flex items-center space-x-2">
        <div
          className={`w-3 h-3 rounded-full flex-shrink-0 ${
            isInSelected ? 'bg-blue-500' : 'bg-gray-400'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1 flex-wrap">
            <span className="text-sm font-medium text-gray-900 min-w-0 break-words">
              {field.name}
            </span>
            {field.isGroupField && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded flex-shrink-0">
                grupo
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-0.5 break-words">
            {field.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Mobile Field Selector Component
function MobileFieldSelector({
  availableFields,
  selectedFields,
  onFieldToggle,
  onFieldReorder,
  ignoreGroups,
  fieldCategories,
}) {
  const moveField = (fieldId, direction) => {
    const currentIndex = selectedFields.indexOf(fieldId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= selectedFields.length) return;

    onFieldReorder(fieldId, newIndex);
  };

  return (
    <div className="space-y-4">
      {/* Available Fields */}
      <div>
        <h5 className="text-md font-medium text-gray-900 mb-3">
          Campos Disponíveis
          <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
            {
              availableFields.filter(
                (f) =>
                  !selectedFields.includes(f.id) &&
                  !(ignoreGroups && f.isGroupField)
              ).length
            }
          </span>
        </h5>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto">
          {Object.entries(fieldCategories).map(([categoryId, category]) => {
            const categoryFields = availableFields.filter(
              (field) =>
                field.category === categoryId &&
                !selectedFields.includes(field.id) &&
                !(ignoreGroups && field.isGroupField)
            );

            if (categoryFields.length === 0) return null;

            return (
              <div key={categoryId} className="mb-4 last:mb-0">
                <h6 className="text-xs font-medium text-gray-600 px-2 py-1 bg-white rounded mb-2">
                  {category.name}
                </h6>
                <div className="space-y-2">
                  {categoryFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {field.name}
                          </span>
                          {field.isGroupField && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded flex-shrink-0">
                              grupo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 truncate">
                          {field.description}
                        </p>
                      </div>
                      <button
                        onClick={() => onFieldToggle(field.id, true)}
                        className="ml-2 p-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex-shrink-0"
                        title="Adicionar campo"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {availableFields.filter(
            (f) =>
              !selectedFields.includes(f.id) &&
              !(ignoreGroups && f.isGroupField)
          ).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Todos os campos foram selecionados</p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Fields */}
      <div>
        <h5 className="text-md font-medium text-gray-900 mb-3">
          Campos Selecionados
          <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">
            {selectedFields.length}
          </span>
        </h5>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 min-h-32">
          {selectedFields.length === 0 ? (
            <div className="text-center py-8 text-blue-500">
              <p className="text-sm">Nenhum campo selecionado</p>
              <p className="text-xs mt-1">Toque no + para adicionar campos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedFields.map((fieldId, index) => {
                const field = availableFields.find((f) => f.id === fieldId);
                if (!field) return null;

                return (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-2 bg-white border border-blue-300 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {field.name}
                        </span>
                        {field.isGroupField && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded flex-shrink-0">
                            grupo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {field.description}
                      </p>
                    </div>

                    <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                      {/* Move Up */}
                      <button
                        onClick={() => moveField(field.id, 'up')}
                        disabled={index === 0}
                        className="p-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Mover para cima"
                      >
                        <ChevronUpIcon className="h-4 w-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        onClick={() => moveField(field.id, 'down')}
                        disabled={index === selectedFields.length - 1}
                        className="p-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Mover para baixo"
                      >
                        <ChevronDownIcon className="h-4 w-4" />
                      </button>

                      {/* Remove */}
                      <button
                        onClick={() => onFieldToggle(field.id, false)}
                        className="p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                        title="Remover campo"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Droppable Zone Component
function DroppableZone({ children, title, description, isEmpty = false, id }) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        border-2 border-dashed rounded-lg p-3 min-h-[200px] sm:min-h-[300px] touch-manipulation
        ${isEmpty ? 'border-gray-300 bg-gray-50' : 'border-blue-300 bg-blue-50'}
        ${
          isOver
            ? 'border-blue-500 bg-blue-100 scale-[1.01] transition-transform'
            : ''
        }
      `}
    >
      {isEmpty ? (
        <div className="h-full flex flex-col items-center justify-center text-center py-6 sm:py-8">
          <div className="w-8 h-8 border-2 border-dashed border-gray-400 rounded mb-2" />
          <p className="text-gray-500 text-sm px-2">Arraste campos aqui</p>
          <p className="text-gray-400 text-xs mt-1 px-2">
            👆 Toque e arraste no mobile
          </p>
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

// Warning Alert Component
function WarningAlert({ warning, onDismiss }) {
  if (!warning) return null;

  return (
    <div className="fixed top-4 right-4 z-[70] max-w-md w-full mx-4">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-lg p-4 shadow-lg">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-orange-800">
              {warning.type === 'duplicate_url'
                ? 'URL Duplicada Detectada'
                : 'Aviso'}
            </h3>
            <div className="mt-2 text-sm text-orange-700">
              <p className="mb-2">{warning.message}</p>

              {warning.duplicatedSessions &&
                warning.duplicatedSessions.length > 0 && (
                  <div className="mt-3">
                    <p className="font-medium mb-2">Sessões com a mesma URL:</p>
                    <div className="space-y-1">
                      {warning.duplicatedSessions.map((session, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-white/60 px-2 py-1 rounded text-xs"
                        >
                          <span className="font-mono text-orange-800">
                            {session.sessionId}
                          </span>
                          <span className="text-orange-600">
                            {session.webhookName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {warning.recommendation && (
                <div className="mt-3 p-2 bg-orange-100/60 rounded text-xs">
                  <p className="font-medium text-orange-800">Recomendação:</p>
                  <p>{warning.recommendation}</p>
                </div>
              )}
            </div>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={onDismiss}
              className="inline-flex text-orange-400 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <XCircleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook para detectar dispositivo mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUA =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(
          userAgent
        );
      const isSmallScreen = window.innerWidth <= 768;
      const hasTouchScreen =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;

      setIsMobile(isMobileUA || (isSmallScreen && hasTouchScreen));
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}

export default function WebhookManager({ sessionId, tokenId, onClose }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const isMobile = useIsMobile();
  const [showFieldMapping, setShowFieldMapping] = useState(false);

  // Available events configuration
  const availableEvents = [
    {
      id: 'messages.upsert',
      name: 'Mensagens Recebidas',
      description: 'Novas mensagens recebidas/enviadas',
      icon: ChatBubbleLeftRightIcon,
      category: 'messages',
      color: 'blue',
    },
    {
      id: 'messages.update',
      name: 'Atualizações de Mensagens',
      description: 'Status de entrega, leitura e edições',
      icon: ArrowPathIcon,
      category: 'messages',
      color: 'green',
    },
    {
      id: 'messages.delete',
      name: 'Mensagens Deletadas',
      description: 'Quando mensagens são deletadas',
      icon: NoSymbolIcon,
      category: 'messages',
      color: 'red',
    },
    {
      id: 'group-participants.update',
      name: 'Mudanças em Grupos',
      description: 'Participantes adicionados/removidos/promovidos',
      icon: UserGroupIcon,
      category: 'groups',
      color: 'purple',
    },
    {
      id: 'connection.update',
      name: 'Status de Conexão',
      description: 'QR Code, conectando, conectado, desconectado',
      icon: BoltIcon,
      category: 'connection',
      color: 'yellow',
    },
  ];

  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    active: true,
    priority: 1,
    events: [
      'messages.upsert',
      'messages.update',
      'messages.delete',
      'group-participants.update',
      'connection.update',
    ],
    ignoreGroups: false,
    version: 'v1',
    selectedFields: [],
    fieldMapping: {}, // Custom field name mappings
  });

  const [testingWebhook, setTestingWebhook] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);
  const [lastWarning, setLastWarning] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Available fields for webhook v2 with new @lid fields
  const availableFields = [
    {
      id: 'key',
      name: 'Key Object (Complete)',
      description: 'Objeto key completo com todos os dados',
      isGroupField: false,
      category: 'core',
    },
    {
      id: 'remoteJid',
      name: 'Remote JID',
      description: 'Número da pessoa que enviou a mensagem',
      isGroupField: false,
      category: 'core',
    },
    {
      id: 'previousRemoteJid',
      name: 'Previous Remote JID',
      description: 'JID original para Business Accounts (@lid)',
      isGroupField: false,
      category: 'business',
    },
    {
      id: 'senderPn',
      name: 'Sender Phone Number',
      description: 'Número processado do remetente',
      isGroupField: false,
      category: 'business',
    },
    {
      id: 'isBusinessAccount',
      name: 'Is Business Account',
      description: 'Indica se é conta business (@lid)',
      isGroupField: false,
      category: 'business',
    },
    {
      id: 'id',
      name: 'Message ID',
      description: 'ID único da mensagem',
      isGroupField: false,
      category: 'core',
    },
    {
      id: 'fromMe',
      name: 'From Me',
      description: 'Indica se foi o próprio número da instância que enviou',
      isGroupField: false,
      category: 'core',
    },
    {
      id: 'conversation',
      name: 'Conversation',
      description: 'Mensagem de texto',
      isGroupField: false,
      category: 'content',
    },
    {
      id: 'messageType',
      name: 'Message Type',
      description: 'Tipo da mensagem (Texto, Áudio, Imagem...)',
      isGroupField: false,
      category: 'content',
    },
    {
      id: 'pushName',
      name: 'Push Name',
      description: 'Nome da pessoa no WhatsApp',
      isGroupField: false,
      category: 'sender',
    },
    {
      id: 'mediaUrl',
      name: 'Media URL',
      description: 'Link direto para mídia (imagens, vídeos, etc.)',
      isGroupField: false,
      category: 'content',
    },
    {
      id: 'timestamp',
      name: 'Timestamp',
      description: 'Horário da mensagem',
      isGroupField: false,
      category: 'core',
    },
    {
      id: 'participant',
      name: 'Participant',
      description: 'Participante em grupos',
      isGroupField: true,
      category: 'group',
    },
    {
      id: 'quotedMessage',
      name: 'Quoted Message',
      description: 'Mensagem citada/respondida',
      isGroupField: false,
      category: 'content',
    },
    {
      id: 'isGroup',
      name: 'Is Group',
      description: 'Indica se é mensagem de grupo',
      isGroupField: true,
      category: 'group',
    },
    {
      id: 'groupName',
      name: 'Group Name',
      description: 'Nome do grupo (se aplicável)',
      isGroupField: true,
      category: 'group',
    },
  ];

  // Categorize fields for better organization
  const fieldCategories = {
    core: { name: 'Campos Essenciais', color: 'blue' },
    business: { name: 'Business Account', color: 'purple' },
    content: { name: 'Conteúdo', color: 'green' },
    sender: { name: 'Remetente', color: 'yellow' },
    group: { name: 'Grupo', color: 'orange' },
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const initializeWebhookManager = async () => {
      await fetchToken();
    };
    initializeWebhookManager();
  }, [tokenId]);

  useEffect(() => {
    if (token) {
      loadWebhooks();
    } else if (!tokenLoading) {
      setLoading(false);
    }
  }, [sessionId, token, tokenLoading]);

  const fetchToken = async () => {
    if (!tokenId) {
      console.error('Token ID não fornecido');
      setTokenLoading(false);
      return;
    }

    try {
      console.log('Fetching token with ID:', tokenId);
      setTokenLoading(true);
      const response = await fetch(
        `${apiUrl}/api/management/tokens/${tokenId}/full`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Token response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Token result:', result);
        if (result.success && result.token) {
          setToken(result.token);
        } else {
          console.error('Erro ao obter token:', result.message);
        }
      } else {
        console.error('Erro na requisição do token:', response.status);
        const errorText = await response.text();
        console.error('Token error response:', errorText);

        if (response.status === 404) {
          console.error(
            'Token não encontrado. O token pode ter sido excluído ou não pertence ao usuário.'
          );
        }
      }
    } catch (error) {
      console.error('Erro ao buscar token:', error);
    } finally {
      console.log('Setting tokenLoading to false');
      setTokenLoading(false);
    }
  };

  const loadWebhooks = async () => {
    try {
      console.log(
        'Loading webhooks for session:',
        sessionId,
        'with token:',
        token ? 'present' : 'missing'
      );
      setLoading(true);
      const response = await fetch(
        `${apiUrl}/api/baileys/session/${sessionId}/webhooks`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Webhooks response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('Webhooks result:', result);
        if (result.success) {
          setWebhooks(result.webhooks || []);
        } else {
          console.error('Webhooks API returned error:', result.message);
        }
      } else {
        console.error('Webhooks request failed with status:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Erro ao carregar webhooks:', error);
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    try {
      const response = await fetch(
        `${apiUrl}/api/baileys/session/${sessionId}/webhooks`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookForm),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadWebhooks();
          setShowCreateModal(false);
          resetForm();

          // Mostrar aviso se houver URL duplicada
          if (result.warning) {
            setLastWarning(result.warning);
            // Auto-dismiss após 10 segundos
            setTimeout(() => setLastWarning(null), 10000);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao criar webhook:', error);
    }
  };

  const updateWebhook = async (webhookId) => {
    try {
      const response = await fetch(
        `${apiUrl}/api/baileys/session/${sessionId}/webhooks/${webhookId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookForm),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadWebhooks();
          setEditingWebhook(null);
          resetForm();

          // Mostrar aviso se houver URL duplicada
          if (result.warning) {
            setLastWarning(result.warning);
            // Auto-dismiss após 10 segundos
            setTimeout(() => setLastWarning(null), 10000);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar webhook:', error);
    }
  };

  const deleteWebhook = async (webhookId) => {
    if (!confirm('Tem certeza que deseja remover este webhook?')) return;

    try {
      const response = await fetch(
        `${apiUrl}/api/baileys/session/${sessionId}/webhooks/${webhookId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadWebhooks();
        }
      }
    } catch (error) {
      console.error('Erro ao deletar webhook:', error);
    }
  };

  const toggleWebhook = async (webhookId) => {
    try {
      const response = await fetch(
        `${apiUrl}/api/baileys/session/${sessionId}/webhooks/${webhookId}/toggle`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await loadWebhooks();
        }
      }
    } catch (error) {
      console.error('Erro ao alternar webhook:', error);
    }
  };

  const testWebhook = async (webhookId) => {
    try {
      setTestingWebhook(webhookId);
      const response = await fetch(
        `${apiUrl}/api/baileys/session/${sessionId}/webhooks/${webhookId}/test`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTestResults((prev) => ({
            ...prev,
            [webhookId]: result.testResult,
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao testar webhook:', error);
    } finally {
      setTestingWebhook(null);
    }
  };

  const resetForm = () => {
    setWebhookForm({
      name: '',
      url: '',
      active: true,
      priority: 1,
      events: [
        'messages.upsert',
        'messages.update',
        'messages.delete',
        'group-participants.update',
        'connection.update',
      ],
      ignoreGroups: false,
      version: 'v1',
      selectedFields: [],
      fieldMapping: {},
    });
    setShowFieldMapping(false);
  };

  const startEdit = (webhook) => {
    setEditingWebhook(webhook.id);
    setWebhookForm({
      name: webhook.name || '',
      url: webhook.url,
      active: webhook.active,
      priority: webhook.priority,
      events: webhook.events || [
        'messages.upsert',
        'messages.update',
        'messages.delete',
        'group-participants.update',
        'connection.update',
      ],
      ignoreGroups: webhook.ignoreGroups || false,
      version: webhook.version || 'v1',
      selectedFields: webhook.selectedFields || [],
      fieldMapping: webhook.fieldMapping || {},
    });
    setShowFieldMapping(Object.keys(webhook.fieldMapping || {}).length > 0);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1:
        return 'text-red-700 bg-red-50 border-red-200';
      case 2:
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 3:
        return 'text-green-700 bg-green-50 border-green-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (active) => {
    return active
      ? 'text-green-700 bg-green-50 border-green-200'
      : 'text-gray-700 bg-gray-50 border-gray-200';
  };

  const getEventColor = (eventId) => {
    const event = availableEvents.find((e) => e.id === eventId);
    if (!event) return 'text-gray-400 bg-gray-500/20 border-gray-500/30';

    const colors = {
      blue: 'text-blue-700 bg-blue-50 border-blue-200',
      green: 'text-green-700 bg-green-50 border-green-200',
      red: 'text-red-700 bg-red-50 border-red-200',
      purple: 'text-purple-700 bg-purple-50 border-purple-200',
      yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    };

    return colors[event.color] || 'text-gray-700 bg-gray-50 border-gray-200';
  };

  const getEventIcon = (eventId) => {
    const event = availableEvents.find((e) => e.id === eventId);
    return event?.icon || CogIcon;
  };

  const getEventName = (eventId) => {
    const event = availableEvents.find((e) => e.id === eventId);
    return event?.name || eventId;
  };

  const toggleEventSelection = (eventId) => {
    setWebhookForm((prev) => {
      const newEvents = prev.events.includes(eventId)
        ? prev.events.filter((id) => id !== eventId)
        : [...prev.events, eventId];

      return {
        ...prev,
        events: newEvents.length > 0 ? newEvents : ['messages.upsert'],
      };
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeField = availableFields.find((f) => f.id === active.id);
    if (!activeField) return;

    console.log('Drag end:', {
      activeId: active.id,
      overId: over.id,
      overData: over.data?.current,
    });

    // Check if field is being dropped in selected area
    if (over.id === 'selected-drop-zone') {
      // Add field to selected if not already there
      if (!webhookForm.selectedFields.includes(activeField.id)) {
        console.log('Adding field to selected:', activeField.id);
        setWebhookForm((prev) => ({
          ...prev,
          selectedFields: [...prev.selectedFields, activeField.id],
        }));
      }
    } else if (over.id === 'available-drop-zone') {
      // Remove field from selected
      console.log('Removing field from selected:', activeField.id);
      setWebhookForm((prev) => ({
        ...prev,
        selectedFields: prev.selectedFields.filter(
          (id) => id !== activeField.id
        ),
      }));
    } else if (over.data?.current?.type === 'field') {
      // Reordering within selected fields
      const oldIndex = webhookForm.selectedFields.indexOf(active.id);
      const newIndex = webhookForm.selectedFields.indexOf(over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        console.log('Reordering fields:', { oldIndex, newIndex });
        setWebhookForm((prev) => ({
          ...prev,
          selectedFields: arrayMove(prev.selectedFields, oldIndex, newIndex),
        }));
      }
    }
  };

  const handleIgnoreGroupsChange = (checked) => {
    setWebhookForm((prev) => {
      let updatedSelectedFields = prev.selectedFields;

      if (checked) {
        const groupFieldIds = availableFields
          .filter((field) => field.isGroupField)
          .map((field) => field.id);

        updatedSelectedFields = prev.selectedFields.filter(
          (fieldId) => !groupFieldIds.includes(fieldId)
        );
      }

      return {
        ...prev,
        ignoreGroups: checked,
        selectedFields: updatedSelectedFields,
      };
    });
  };

  // Mobile field management functions
  const handleMobileFieldToggle = (fieldId, add) => {
    setWebhookForm((prev) => {
      if (add) {
        // Add field if not already selected
        if (!prev.selectedFields.includes(fieldId)) {
          return {
            ...prev,
            selectedFields: [...prev.selectedFields, fieldId],
          };
        }
      } else {
        // Remove field
        return {
          ...prev,
          selectedFields: prev.selectedFields.filter((id) => id !== fieldId),
        };
      }
      return prev;
    });
  };

  const handleMobileFieldReorder = (fieldId, newIndex) => {
    setWebhookForm((prev) => {
      const currentIndex = prev.selectedFields.indexOf(fieldId);
      if (currentIndex === -1) return prev;

      const newSelectedFields = [...prev.selectedFields];
      const [movedField] = newSelectedFields.splice(currentIndex, 1);
      newSelectedFields.splice(newIndex, 0, movedField);

      return {
        ...prev,
        selectedFields: newSelectedFields,
      };
    });
  };

  // Field mapping management functions
  const handleFieldMappingChange = (originalField, customName) => {
    setWebhookForm((prev) => {
      const newFieldMapping = { ...prev.fieldMapping };

      if (customName && customName.trim() !== '') {
        newFieldMapping[originalField] = customName.trim();
      } else {
        delete newFieldMapping[originalField];
      }

      return {
        ...prev,
        fieldMapping: newFieldMapping,
      };
    });
  };

  const resetFieldMapping = () => {
    setWebhookForm((prev) => ({
      ...prev,
      fieldMapping: {},
    }));
  };

  const dismissWarning = () => {
    setLastWarning(null);
  };

  if (tokenLoading || loading) {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/95 backdrop-blur-xl border border-gray-200 p-8 max-w-md w-full mx-4 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-lg font-medium text-gray-900">
              {tokenLoading ? 'Autenticando...' : 'Carregando webhooks...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white/95 backdrop-blur-xl border border-gray-200 p-8 max-w-md w-full mx-4 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-center text-center">
            <div>
              <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Erro de Autenticação
              </h3>
              <p className="text-gray-600 mb-6">
                Não foi possível obter o token de acesso. O token pode ter
                expirado ou sido excluído.
                <br />
                <span className="text-sm text-gray-500">
                  Crie um novo token na aba "Tokens de API".
                </span>
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-black/30 backdrop-blur-sm" />
        <div
          className="relative h-full bg-gradient-to-br from-white via-white to-gray-50/80 backdrop-blur-xl border border-gray-200/50 overflow-y-auto shadow-2xl"
          style={{
            borderRadius: '24px',
            margin: '16px',
            height: 'calc(100vh - 32px)',
          }}
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="p-2 bg-blue-500 rounded-lg flex-shrink-0">
                  <LinkIcon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                    Webhook Manager
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    Sessão: {sessionId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowCreateModal(true)}
                  disabled={webhooks.length >= 3}
                  className="flex items-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm touch-manipulation"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Novo Webhook</span>
                  <span className="sm:hidden">Novo</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 touch-manipulation"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* Webhooks List */}
            <div className="space-y-4">
              {webhooks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg mx-auto mb-4 flex items-center justify-center">
                    <LinkIcon className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Nenhum webhook configurado
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Configure webhooks para receber eventos em tempo real do
                    WhatsApp
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Criar Primeiro Webhook
                  </button>
                </div>
              ) : (
                webhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="bg-white border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {webhook.name || 'Webhook'}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                              webhook.active
                            )}`}
                          >
                            {webhook.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(
                              webhook.priority
                            )}`}
                          >
                            P{webhook.priority}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              webhook.version === 'v2'
                                ? 'text-purple-700 bg-purple-100'
                                : 'text-gray-700 bg-gray-100'
                            }`}
                          >
                            {webhook.version === 'v2' ? 'v2' : 'v1'}
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">
                              URL:
                            </span>
                            <div className="font-mono bg-gray-50 px-2 py-1 rounded text-xs text-gray-800 break-all mt-1">
                              {webhook.url}
                            </div>
                          </div>

                          <div>
                            <span className="font-medium text-gray-700">
                              Eventos:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {webhook.events.map((event, index) => (
                                <span
                                  key={index}
                                  className={`px-2 py-1 rounded text-xs ${getEventColor(
                                    event
                                  )}`}
                                  title={
                                    availableEvents.find((e) => e.id === event)
                                      ?.description || event
                                  }
                                >
                                  {getEventName(event)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            <span className="font-medium text-gray-700">
                              Grupos:
                            </span>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                webhook.ignoreGroups
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {webhook.ignoreGroups ? 'Ignorados' : 'Incluídos'}
                            </span>

                            {testResults[webhook.id] && (
                              <>
                                <span className="font-medium text-gray-700">
                                  Teste:
                                </span>
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    testResults[webhook.id].success
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {testResults[webhook.id].success
                                    ? 'OK'
                                    : 'Erro'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-4">
                        <button
                          onClick={() => testWebhook(webhook.id)}
                          disabled={testingWebhook === webhook.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                          title="Testar webhook"
                        >
                          {testingWebhook === webhook.id ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <BoltIcon className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          onClick={() => toggleWebhook(webhook.id)}
                          className={`p-2 rounded ${
                            webhook.active
                              ? 'text-yellow-600 hover:bg-yellow-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={webhook.active ? 'Desativar' : 'Ativar'}
                        >
                          {webhook.active ? (
                            <PauseIcon className="h-4 w-4" />
                          ) : (
                            <PlayIcon className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          onClick={() => startEdit(webhook)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => deleteWebhook(webhook.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Remover"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Info */}
            {webhooks.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 mr-2" />
                  <span className="text-yellow-700 text-sm">
                    Máximo de 3 webhooks por sessão. {3 - webhooks.length}{' '}
                    restante(s).
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingWebhook) && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={() => {
            setShowCreateModal(false);
            setEditingWebhook(null);
            resetForm();
          }}
        >
          <div
            className="bg-white border w-full h-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRadius: '12px',
              margin: window.innerWidth <= 768 ? '8px' : '16px',
              height:
                window.innerWidth <= 768
                  ? 'calc(100vh - 16px)'
                  : 'calc(100vh - 32px)',
            }}
          >
            {/* Header */}
            <div className="bg-white border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className="p-2 bg-blue-500 rounded flex-shrink-0">
                    {editingWebhook ? (
                      <PencilIcon className="h-4 w-4 text-white" />
                    ) : (
                      <PlusIcon className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                    {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingWebhook(null);
                    resetForm();
                  }}
                  className="p-2 bg-red-500 text-white rounded hover:bg-red-600 flex-shrink-0 touch-manipulation"
                >
                  <XCircleIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-6">
                {/* Basic Configuration */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                    <CogIcon className="h-4 w-4 mr-2 text-blue-600" />
                    Configuração Básica
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nome (opcional)
                      </label>
                      <input
                        type="text"
                        value={webhookForm.name}
                        onChange={(e) =>
                          setWebhookForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Ex: Webhook Principal"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prioridade
                      </label>
                      <select
                        value={webhookForm.priority}
                        onChange={(e) =>
                          setWebhookForm((prev) => ({
                            ...prev,
                            priority: parseInt(e.target.value),
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                      >
                        <option value={1}>1 - Alta</option>
                        <option value={2}>2 - Média</option>
                        <option value={3}>3 - Baixa</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL do Webhook *
                    </label>
                    <input
                      type="url"
                      value={webhookForm.url}
                      onChange={(e) =>
                        setWebhookForm((prev) => ({
                          ...prev,
                          url: e.target.value,
                        }))
                      }
                      placeholder="https://meusite.com/webhook"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Versão do Webhook
                    </label>
                    <select
                      value={webhookForm.version}
                      onChange={(e) =>
                        setWebhookForm((prev) => ({
                          ...prev,
                          version: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                    >
                      <option value="v1">v1 - Webhook Original</option>
                      <option value="v2">
                        v2 - Webhook Avançado (Baileys Enhanced)
                      </option>
                    </select>
                    <p className="text-sm text-gray-600 mt-2 bg-blue-50 p-2 rounded border border-blue-200">
                      v2 oferece estrutura de eventos aprimorada com suporte
                      completo a @lid e drag-and-drop
                    </p>
                  </div>

                  <div className="flex flex-col space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={webhookForm.active}
                        onChange={(e) =>
                          setWebhookForm((prev) => ({
                            ...prev,
                            active: e.target.checked,
                          }))
                        }
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Webhook ativo
                      </span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={webhookForm.ignoreGroups}
                        onChange={(e) =>
                          handleIgnoreGroupsChange(e.target.checked)
                        }
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Ignorar mensagens de grupos
                      </span>
                    </label>
                  </div>
                </div>

                {/* Events Configuration */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                    <BoltIcon className="h-4 w-4 mr-2 text-blue-600" />
                    Eventos para Escutar
                  </h4>

                  <div className="grid grid-cols-1 gap-2">
                    {availableEvents.map((event) => {
                      const isSelected = webhookForm.events.includes(event.id);

                      return (
                        <div
                          key={event.id}
                          className={`p-3 rounded-lg border cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 border-blue-300'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => toggleEventSelection(event.id)}
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleEventSelection(event.id)}
                              className="rounded border-gray-300 text-blue-600"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-gray-900">
                                  {event.name}
                                </span>
                                <span className="ml-2 px-2 py-1 rounded text-xs bg-gray-100 text-gray-600">
                                  {event.category}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {event.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Field Selection for v2 */}
                {webhookForm.version === 'v2' && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Squares2X2Icon className="h-4 w-4 text-blue-600" />
                      <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                        Campos do Webhook v2 -
                        {isMobile ? 'Toque & Botões' : 'Drag & Drop'}
                      </h4>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-700">
                        <strong>Como usar:</strong>{' '}
                        {isMobile
                          ? 'Toque nos botões + para adicionar campos e use as setas para reordenar.'
                          : 'Arraste campos da área "Disponíveis" para "Selecionados"'}{' '}
                        Deixe vazio para enviar payload completo.
                      </p>
                    </div>

                    {isMobile ? (
                      /* Mobile Interface */
                      <MobileFieldSelector
                        availableFields={availableFields}
                        selectedFields={webhookForm.selectedFields}
                        onFieldToggle={handleMobileFieldToggle}
                        onFieldReorder={handleMobileFieldReorder}
                        ignoreGroups={webhookForm.ignoreGroups}
                        fieldCategories={fieldCategories}
                      />
                    ) : (
                      /* Desktop Drag & Drop Interface */
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {/* Available Fields */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <h5 className="text-sm sm:text-md font-medium text-gray-900">
                                  Disponíveis
                                </h5>
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                  {
                                    availableFields.filter(
                                      (f) =>
                                        !webhookForm.selectedFields.includes(
                                          f.id
                                        ) &&
                                        !(
                                          webhookForm.ignoreGroups &&
                                          f.isGroupField
                                        )
                                    ).length
                                  }
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 hidden sm:block">
                                🖱️ Arraste campos
                              </div>
                            </div>

                            <DroppableZone
                              id="available-drop-zone"
                              title=""
                              description=""
                              isEmpty={false}
                            >
                              <div className="space-y-2 max-h-96 overflow-y-auto">
                                {Object.entries(fieldCategories).map(
                                  ([categoryId, category]) => {
                                    const categoryFields =
                                      availableFields.filter(
                                        (field) =>
                                          field.category === categoryId &&
                                          !webhookForm.selectedFields.includes(
                                            field.id
                                          ) &&
                                          !(
                                            webhookForm.ignoreGroups &&
                                            field.isGroupField
                                          )
                                      );

                                    if (categoryFields.length === 0)
                                      return null;

                                    return (
                                      <div
                                        key={categoryId}
                                        className="space-y-1"
                                      >
                                        <h6 className="text-xs font-medium text-gray-600 px-2 py-1 bg-gray-100 rounded sticky top-0 z-10">
                                          {category.name}
                                        </h6>
                                        <div className="space-y-1">
                                          {categoryFields.map((field) => (
                                            <DraggableField
                                              key={field.id}
                                              field={field}
                                              isInSelected={false}
                                            />
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            </DroppableZone>
                          </div>

                          {/* Selected Fields */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <h5 className="text-sm sm:text-md font-medium text-gray-900">
                                  Selecionados
                                </h5>
                                <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">
                                  {webhookForm.selectedFields.length}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 hidden sm:block">
                                🔄 Reordene aqui
                              </div>
                            </div>

                            <DroppableZone
                              id="selected-drop-zone"
                              title=""
                              description=""
                              isEmpty={webhookForm.selectedFields.length === 0}
                            >
                              <div className="max-h-96 overflow-y-auto">
                                <SortableContext
                                  items={webhookForm.selectedFields}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {webhookForm.selectedFields.length ===
                                  0 ? null : (
                                    <div className="space-y-2">
                                      {webhookForm.selectedFields.map(
                                        (fieldId) => {
                                          const field = availableFields.find(
                                            (f) => f.id === fieldId
                                          );
                                          return field ? (
                                            <DraggableField
                                              key={field.id}
                                              field={field}
                                              isInSelected={true}
                                            />
                                          ) : null;
                                        }
                                      )}
                                    </div>
                                  )}
                                </SortableContext>
                              </div>
                            </DroppableZone>
                          </div>
                        </div>

                        <DragOverlay>
                          {activeId ? (
                            <DraggableField
                              field={availableFields.find(
                                (f) => f.id === activeId
                              )}
                              isDragOverlay={true}
                            />
                          ) : null}
                        </DragOverlay>
                      </DndContext>
                    )}

                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-blue-700">
                            Status:
                          </span>
                          <span className="text-sm text-blue-600">
                            {webhookForm.selectedFields.length === 0
                              ? 'Payload completo será enviado'
                              : `${webhookForm.selectedFields.length} campo(s) selecionado(s)`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowFieldMapping(!showFieldMapping)}
                          className={`flex items-center space-x-1 text-xs px-3 py-2 rounded-lg transition-all touch-manipulation ${
                            showFieldMapping
                              ? 'bg-purple-500 text-white shadow-md'
                              : 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 hover:from-purple-200 hover:to-pink-200 border border-purple-200'
                          }`}
                        >
                          <CodeBracketIcon className="h-4 w-4" />
                          <span className="hidden sm:inline font-medium">
                            {showFieldMapping
                              ? 'Fechar Personalização'
                              : 'Personalizar Nomes'}
                          </span>
                          <span className="sm:hidden font-medium">
                            {showFieldMapping ? 'Fechar' : 'Nomes'}
                          </span>
                          <SparklesIcon className="h-3 w-3 animate-pulse" />
                        </button>
                      </div>

                      {/* Feature highlight when not shown */}
                      {!showFieldMapping && (
                        <div className="mt-2 flex items-center space-x-2 text-xs">
                          <SparklesIcon className="h-3 w-3 text-purple-500 animate-pulse" />
                          <span className="text-purple-600 font-medium">
                            NOVO:
                          </span>
                          <span className="text-purple-700">
                            Personalize os nomes dos campos no webhook
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Field Mapping Section for v2 */}
                {webhookForm.version === 'v2' && showFieldMapping && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CodeBracketIcon className="h-4 w-4 text-purple-600" />
                        <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                          Personalizar Nomes dos Campos
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={resetFieldMapping}
                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors touch-manipulation"
                      >
                        Resetar
                      </button>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-700">
                        <strong>Personalize os nomes:</strong> Altere como os
                        campos aparecem no webhook. Exemplo: "remoteJid" →
                        "numeroRemetente" ou "pushName" → "nomeContato".
                      </p>
                    </div>

                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {availableFields
                        .filter(
                          (field) =>
                            webhookForm.selectedFields.length === 0 ||
                            webhookForm.selectedFields.includes(field.id)
                        )
                        .map((field) => (
                          <div
                            key={field.id}
                            className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">
                                  {field.name}
                                </span>
                                {field.isGroupField && (
                                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded flex-shrink-0">
                                    grupo
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                {field.description}
                              </p>
                              <p className="text-xs text-purple-600 font-mono mt-1">
                                Campo: {field.id}
                              </p>
                            </div>
                            <div className="flex-shrink-0 w-full sm:w-48">
                              <input
                                type="text"
                                placeholder={`Personalizar "${field.id}"`}
                                value={webhookForm.fieldMapping[field.id] || ''}
                                onChange={(e) =>
                                  handleFieldMappingChange(
                                    field.id,
                                    e.target.value
                                  )
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                              />
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-green-700">
                          Mapeamentos ativos:
                        </span>
                        <span className="text-sm text-green-600">
                          {Object.keys(webhookForm.fieldMapping).length}{' '}
                          campo(s) personalizados
                        </span>
                      </div>
                      {Object.keys(webhookForm.fieldMapping).length > 0 && (
                        <div className="space-y-1">
                          {Object.entries(webhookForm.fieldMapping).map(
                            ([original, custom]) => (
                              <div
                                key={original}
                                className="flex items-center justify-between text-xs bg-white p-2 rounded"
                              >
                                <span className="font-mono text-gray-600">
                                  {original}
                                </span>
                                <span className="mx-2 text-gray-400">→</span>
                                <span className="font-mono text-green-700 font-semibold">
                                  {custom}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t px-4 py-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    if (editingWebhook) {
                      updateWebhook(editingWebhook);
                    } else {
                      createWebhook();
                    }
                  }}
                  disabled={!webhookForm.url}
                  className="flex-1 py-3 sm:py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium touch-manipulation"
                >
                  {editingWebhook ? 'Atualizar' : 'Criar'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingWebhook(null);
                    resetForm();
                  }}
                  className="flex-1 py-3 sm:py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium touch-manipulation"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Alert */}
      <WarningAlert warning={lastWarning} onDismiss={dismissWarning} />
    </>
  );
}
