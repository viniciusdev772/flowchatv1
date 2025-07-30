import {
  ArrowPathIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CogIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  NoSymbolIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  XCircleIcon,
  Squares2X2Icon,
  ClipboardDocumentListIcon,
  EyeIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
  SortableContext as SortableContextProvider,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';

// Hook personalizado para detectar dispositivo móvel
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const isMobileUA = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      
      setIsMobile(isMobileUA || (isTouchDevice && isSmallScreen));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
}

// Componente de seleção de campos para mobile (sem drag and drop)
function MobileFieldSelector({ availableFields, selectedFields, onFieldToggle, fieldCategories, ignoreGroups }) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-700">
          <strong>Seleção de Campos:</strong> Toque nos campos para adicionar/remover do payload do webhook.
          <br />Deixe vazio para enviar payload completo.
        </p>
      </div>

      {Object.entries(fieldCategories).map(([categoryId, category]) => {
        const categoryFields = availableFields.filter(
          field => 
            field.category === categoryId && 
            !(ignoreGroups && field.isGroupField)
        );

        if (categoryFields.length === 0) return null;

        return (
          <div key={categoryId} className="space-y-2">
            <h6 className="text-sm font-medium text-gray-700 px-3 py-2 bg-gray-100 rounded-lg">
              {category.name}
            </h6>
            <div className="space-y-2">
              {categoryFields.map((field) => {
                const isSelected = selectedFields.includes(field.id);
                return (
                  <div
                    key={field.id}
                    className={`
                      p-4 rounded-lg border cursor-pointer transition-all touch-manipulation
                      ${isSelected 
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                      }
                    `}
                    onClick={() => onFieldToggle(field.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        isSelected ? 'bg-blue-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {field.name}
                          </span>
                          {field.isGroupField && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                              grupo
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                              selecionado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {field.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selectedFields.length > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h6 className="text-sm font-medium text-green-800 mb-2">
            Campos Selecionados ({selectedFields.length})
          </h6>
          <div className="flex flex-wrap gap-2">
            {selectedFields.map(fieldId => {
              const field = availableFields.find(f => f.id === fieldId);
              return field ? (
                <span 
                  key={fieldId}
                  className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md"
                >
                  {field.name}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Draggable Field Component
function DraggableField({ field, isInSelected = false, isDragOverlay = false }) {
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
      style={style}
      {...attributes}
      {...listeners}
      className={`
        bg-white border rounded-lg p-3 cursor-grab select-none
        ${isDragging ? 'opacity-50' : ''}
        ${isInSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        active:cursor-grabbing touch-manipulation
        min-h-[60px] sm:min-h-[50px]
      `}
    >
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isInSelected ? 'bg-blue-500' : 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium truncate text-gray-900">
              {field.name}
            </span>
            {field.isGroupField && (
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded flex-shrink-0">
                grupo
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 truncate mt-0.5">
            {field.description}
          </p>
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
        border-2 border-dashed rounded-lg p-3 sm:p-4 min-h-[200px] sm:min-h-[300px]
        ${isEmpty ? 'border-gray-300 bg-gray-50' : 'border-blue-300 bg-blue-50'}
        ${isOver ? 'border-blue-500 bg-blue-100' : ''}
        touch-manipulation
      `}
    >
      {isEmpty ? (
        <div className="h-full flex flex-col items-center justify-center text-center py-6 sm:py-8">
          <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-dashed border-gray-400 rounded mb-2" />
          <p className="text-gray-500 text-sm">Arraste campos aqui</p>
        </div>
      ) : (
        <div className="space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

export default function WebhookManager({ sessionId, tokenId, onClose }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const isMobile = useIsMobile();
  
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
  });
  
  const [testingWebhook, setTestingWebhook] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [token, setToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(true);

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

  // Configurar sensores apenas para desktop (não mobile)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    // TouchSensor desabilitado em mobile para evitar conflitos
    ...(isMobile ? [] : [useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8,
      },
    })]),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Função para alternar seleção de campos em mobile
  const handleFieldToggle = (fieldId) => {
    setWebhookForm(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.includes(fieldId)
        ? prev.selectedFields.filter(id => id !== fieldId)
        : [...prev.selectedFields, fieldId]
    }));
  };

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
    });
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
    });
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

    const activeField = availableFields.find(f => f.id === active.id);
    if (!activeField) return;

    console.log('Drag end:', { activeId: active.id, overId: over.id, overData: over.data?.current });

    // Check if field is being dropped in selected area
    if (over.id === 'selected-drop-zone') {
      // Add field to selected if not already there
      if (!webhookForm.selectedFields.includes(activeField.id)) {
        console.log('Adding field to selected:', activeField.id);
        setWebhookForm(prev => ({
          ...prev,
          selectedFields: [...prev.selectedFields, activeField.id]
        }));
      }
    } else if (over.id === 'available-drop-zone') {
      // Remove field from selected
      console.log('Removing field from selected:', activeField.id);
      setWebhookForm(prev => ({
        ...prev,
        selectedFields: prev.selectedFields.filter(id => id !== activeField.id)
      }));
    } else if (over.data?.current?.type === 'field') {
      // Reordering within selected fields
      const oldIndex = webhookForm.selectedFields.indexOf(active.id);
      const newIndex = webhookForm.selectedFields.indexOf(over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        console.log('Reordering fields:', { oldIndex, newIndex });
        setWebhookForm(prev => ({
          ...prev,
          selectedFields: arrayMove(prev.selectedFields, oldIndex, newIndex)
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
            borderRadius: isMobile ? '16px' : '24px',
            margin: isMobile ? '4px' : '16px',
            height: isMobile ? 'calc(100vh - 8px)' : 'calc(100vh - 32px)',
          }}
        >
          {/* Header */}
          <div className={`bg-white border-b border-gray-200 ${isMobile ? 'px-4 py-4' : 'px-6 py-4'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className={`${isMobile ? 'p-2' : 'p-2'} bg-blue-500 rounded-lg flex-shrink-0`}>
                  <LinkIcon className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} text-white`} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-gray-900 truncate`}>
                    Webhook Manager
                  </h2>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-600 truncate`}>
                    Sessão: {sessionId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowCreateModal(true)}
                  disabled={webhooks.length >= 3}
                  className={`flex items-center ${isMobile ? 'px-3 py-3 text-sm' : 'px-4 py-2 text-base'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation transition-colors`}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  <span className={isMobile ? 'text-xs' : 'hidden sm:inline'}>
                    {isMobile ? 'Novo' : 'Novo Webhook'}
                  </span>
                  {!isMobile && <span className="sm:hidden">Novo</span>}
                </button>
                <button
                  onClick={onClose}
                  className={`${isMobile ? 'p-3' : 'p-2'} bg-red-500 text-white rounded-lg hover:bg-red-600 touch-manipulation transition-colors`}
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className={isMobile ? 'p-4' : 'p-6'}>
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
                    Configure webhooks para receber eventos em tempo real do WhatsApp
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
                    className={`bg-white border border-gray-200 rounded-lg ${isMobile ? 'p-4' : 'p-4'} transition-shadow hover:shadow-md`}
                  >
                    <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                            {webhook.name || 'Webhook'}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${getStatusColor(
                              webhook.active
                            )}`}
                          >
                            {webhook.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${getPriorityColor(
                              webhook.priority
                            )}`}
                          >
                            P{webhook.priority}
                          </span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
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
                            <span className="font-medium text-gray-700">URL:</span>
                            <div className="font-mono bg-gray-50 px-2 py-1 rounded text-xs text-gray-800 break-all mt-1">
                              {webhook.url}
                            </div>
                          </div>
                          
                          <div>
                            <span className="font-medium text-gray-700">Eventos:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {webhook.events.map((event, index) => (
                                <span
                                  key={index}
                                  className={`px-2 py-1 rounded text-xs ${getEventColor(event)}`}
                                  title={availableEvents.find((e) => e.id === event)?.description || event}
                                >
                                  <span className="hidden sm:inline">{getEventName(event)}</span>
                                  <span className="sm:hidden">{getEventName(event).split(' ')[0]}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-700">Grupos:</span>
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  webhook.ignoreGroups
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                                }`}
                              >
                                {webhook.ignoreGroups ? 'Ignorados' : 'Incluídos'}
                              </span>
                            </div>
                            
                            {testResults[webhook.id] && (
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-gray-700">Teste:</span>
                                <span
                                  className={`px-2 py-1 rounded text-xs ${
                                    testResults[webhook.id].success
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {testResults[webhook.id].success ? 'OK' : 'Erro'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`flex items-center ${isMobile ? 'justify-start gap-3' : 'justify-end gap-1 sm:gap-1 sm:ml-4'} flex-shrink-0`}>
                        <button
                          onClick={() => testWebhook(webhook.id)}
                          disabled={testingWebhook === webhook.id}
                          className={`${isMobile ? 'p-3 min-w-[44px] min-h-[44px]' : 'p-2'} text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50 touch-manipulation transition-colors`}
                          title="Testar webhook"
                        >
                          {testingWebhook === webhook.id ? (
                            <ArrowPathIcon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} animate-spin`} />
                          ) : (
                            <BoltIcon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
                          )}
                        </button>

                        <button
                          onClick={() => toggleWebhook(webhook.id)}
                          className={`${isMobile ? 'p-3 min-w-[44px] min-h-[44px]' : 'p-2'} rounded touch-manipulation transition-colors ${
                            webhook.active
                              ? 'text-yellow-600 hover:bg-yellow-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={webhook.active ? 'Desativar' : 'Ativar'}
                        >
                          {webhook.active ? (
                            <PauseIcon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
                          ) : (
                            <PlayIcon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
                          )}
                        </button>

                        <button
                          onClick={() => startEdit(webhook)}
                          className={`${isMobile ? 'p-3 min-w-[44px] min-h-[44px]' : 'p-2'} text-blue-600 hover:bg-blue-50 rounded touch-manipulation transition-colors`}
                          title="Editar"
                        >
                          <PencilIcon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
                        </button>

                        <button
                          onClick={() => deleteWebhook(webhook.id)}
                          className={`${isMobile ? 'p-3 min-w-[44px] min-h-[44px]' : 'p-2'} text-red-600 hover:bg-red-50 rounded touch-manipulation transition-colors`}
                          title="Remover"
                        >
                          <TrashIcon className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'}`} />
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
                    Máximo de 3 webhooks por sessão. {3 - webhooks.length} restante(s).
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
              borderRadius: window.innerWidth < 640 ? '8px' : '12px',
              margin: window.innerWidth < 640 ? '8px' : '16px',
              height: window.innerWidth < 640 ? 'calc(100vh - 16px)' : 'calc(100vh - 32px)',
            }}
          >
              {/* Header */}
              <div className="bg-white border-b px-3 sm:px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <div className="p-1.5 sm:p-2 bg-blue-500 rounded flex-shrink-0">
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
                    className="p-2 bg-red-500 text-white rounded hover:bg-red-600 touch-manipulation flex-shrink-0"
                  >
                    <XCircleIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4">
                <div className="space-y-4 sm:space-y-6">
                  {/* Basic Configuration */}
                  <div className="space-y-3 sm:space-y-4">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                      <CogIcon className="h-4 w-4 mr-2 text-blue-600" />
                      Configuração Básica
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 text-base sm:text-sm"
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
                          className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 text-base sm:text-sm"
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
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 text-base sm:text-sm"
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
                        className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500 text-base sm:text-sm"
                      >
                        <option value="v1">v1 - Webhook Original</option>
                        <option value="v2">v2 - Webhook Avançado (Baileys Enhanced)</option>
                      </select>
                      <p className="text-sm text-gray-600 mt-2 bg-blue-50 p-2 rounded border border-blue-200">
                        v2 oferece estrutura de eventos aprimorada com suporte completo a @lid e drag-and-drop
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
                          onChange={(e) => handleIgnoreGroupsChange(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Ignorar mensagens de grupos
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Events Configuration */}
                  <div className="space-y-3 sm:space-y-4">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                      <BoltIcon className="h-4 w-4 mr-2 text-blue-600" />
                      Eventos para Escutar
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {availableEvents.map((event) => {
                        const isSelected = webhookForm.events.includes(event.id);

                        return (
                          <div
                            key={event.id}
                            className={`p-3 rounded-lg border cursor-pointer touch-manipulation ${
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
                                className="rounded border-gray-300 text-blue-600 w-4 h-4 flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="ml-3 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {event.name}
                                  </span>
                                  <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 flex-shrink-0">
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

                  {/* Field Selection for v2 - Responsive */}
                  {webhookForm.version === 'v2' && (
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center space-x-2">
                        <Squares2X2Icon className="h-4 w-4 text-blue-600" />
                        <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                          Campos do Webhook v2 {isMobile ? '' : '- Drag & Drop'}
                        </h4>
                      </div>

                      {/* Interface Mobile - Sem Drag and Drop */}
                      {isMobile ? (
                        <MobileFieldSelector
                          availableFields={availableFields}
                          selectedFields={webhookForm.selectedFields}
                          onFieldToggle={handleFieldToggle}
                          fieldCategories={fieldCategories}
                          ignoreGroups={webhookForm.ignoreGroups}
                        />
                      ) : (
                        /* Interface Desktop - Com Drag and Drop */
                        <>
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-700">
                              <strong>Como usar:</strong> Arraste campos da área "Disponíveis" para "Selecionados" para customizar o payload do webhook.
                              <br />Deixe vazio para enviar payload completo.
                            </p>
                          </div>

                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Available Fields */}
                              <div>
                                <div className="flex items-center space-x-2 mb-3">
                                  <h5 className="text-base font-medium text-gray-900">
                                    Campos Disponíveis
                                  </h5>
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                    {availableFields.filter(f => !webhookForm.selectedFields.includes(f.id) && 
                                      !(webhookForm.ignoreGroups && f.isGroupField)).length}
                                  </span>
                                </div>
                                
                                <DroppableZone 
                                  id="available-drop-zone"
                                  title=""
                                  description=""
                                  isEmpty={false}
                                >
                                  <div className="space-y-2">
                                    {Object.entries(fieldCategories).map(([categoryId, category]) => {
                                      const categoryFields = availableFields.filter(
                                        field => 
                                          field.category === categoryId && 
                                          !webhookForm.selectedFields.includes(field.id) &&
                                          !(webhookForm.ignoreGroups && field.isGroupField)
                                      );

                                      if (categoryFields.length === 0) return null;

                                      return (
                                        <div key={categoryId} className="space-y-1">
                                          <h6 className="text-xs font-medium text-gray-600 px-2 py-1 bg-gray-100 rounded">
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
                                    })}
                                  </div>
                                </DroppableZone>
                              </div>

                              {/* Selected Fields */}
                              <div>
                                <div className="flex items-center space-x-2 mb-3">
                                  <h5 className="text-base font-medium text-gray-900">
                                    Campos Selecionados
                                  </h5>
                                  <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">
                                    {webhookForm.selectedFields.length}
                                  </span>
                                </div>
                                
                                <DroppableZone 
                                  id="selected-drop-zone"
                                  title=""
                                  description=""
                                  isEmpty={webhookForm.selectedFields.length === 0}
                                >
                                  <SortableContext
                                    items={webhookForm.selectedFields}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {webhookForm.selectedFields.length === 0 ? null : (
                                      <div className="space-y-2">
                                        {webhookForm.selectedFields.map((fieldId) => {
                                          const field = availableFields.find(f => f.id === fieldId);
                                          return field ? (
                                            <DraggableField
                                              key={field.id}
                                              field={field}
                                              isInSelected={true}
                                            />
                                          ) : null;
                                        })}
                                      </div>
                                    )}
                                  </SortableContext>
                                </DroppableZone>
                              </div>
                            </div>

                            <DragOverlay>
                              {activeId ? (
                                <DraggableField
                                  field={availableFields.find(f => f.id === activeId)}
                                  isDragOverlay={true}
                                />
                              ) : null}
                            </DragOverlay>
                          </DndContext>
                        </>
                      )}

                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-blue-700">Status:</span>
                          <span className="text-sm text-blue-600">
                            {webhookForm.selectedFields.length === 0
                              ? 'Payload completo será enviado'
                              : `${webhookForm.selectedFields.length} campo(s) selecionado(s)`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className={`bg-white border-t ${isMobile ? 'px-4 py-4' : 'px-4 py-3'}`}>
                <div className={`flex ${isMobile ? 'flex-col gap-3' : 'flex-col sm:flex-row gap-2 sm:gap-3'}`}>
                  <button
                    onClick={() => {
                      if (editingWebhook) {
                        updateWebhook(editingWebhook);
                      } else {
                        createWebhook();
                      }
                    }}
                    disabled={!webhookForm.url}
                    className={`flex-1 ${isMobile ? 'py-4 px-4 text-base min-h-[52px]' : 'py-3 sm:py-2 px-4 text-base sm:text-sm'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium touch-manipulation transition-colors`}
                  >
                    {editingWebhook ? 'Atualizar' : 'Criar'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingWebhook(null);
                      resetForm();
                    }}
                    className={`flex-1 ${isMobile ? 'py-4 px-4 text-base min-h-[52px]' : 'py-3 sm:py-2 px-4 text-base sm:text-sm'} bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium touch-manipulation transition-colors`}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}