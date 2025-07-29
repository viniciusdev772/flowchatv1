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
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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

  const getFieldIcon = (fieldId) => {
    const iconMap = {
      key: CodeBracketIcon,
      remoteJid: ChatBubbleLeftRightIcon,
      previousRemoteJid: LinkIcon,
      senderPn: UserGroupIcon,
      isBusinessAccount: SparklesIcon,
      id: DocumentTextIcon,
      fromMe: UserGroupIcon,
      conversation: ChatBubbleLeftRightIcon,
      messageType: Squares2X2Icon,
      pushName: UserGroupIcon,
      mediaUrl: LinkIcon,
      timestamp: ClipboardDocumentListIcon,
      participant: UserGroupIcon,
      quotedMessage: ChatBubbleLeftRightIcon,
      isGroup: UserGroupIcon,
      groupName: UserGroupIcon,
    };
    return iconMap[fieldId] || CogIcon;
  };

  const FieldIcon = getFieldIcon(field.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative bg-gradient-to-br from-white to-gray-50 
        border border-gray-300 rounded-xl p-4 cursor-grab
        hover:shadow-lg transition-all duration-300 select-none
        ${isDragging ? 'opacity-50 scale-105 shadow-2xl z-50' : ''}
        ${isDragOverlay ? 'rotate-2 shadow-2xl scale-110' : ''}
        ${isInSelected ? 'ring-2 ring-purple-500 bg-gradient-to-br from-purple-50 to-purple-100' : ''}
        hover:border-gray-400 active:cursor-grabbing
      `}
    >
      <div className="flex items-center space-x-3">
        <div className={`
          p-2 rounded-lg transition-colors duration-200
          ${isInSelected 
            ? 'bg-purple-500 text-white' 
            : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
          }
        `}>
          <FieldIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className={`
              text-sm font-semibold truncate
              ${isInSelected ? 'text-purple-900' : 'text-gray-900'}
            `}>
              {field.name}
            </h3>
            {field.isGroupField && (
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                grupo
              </span>
            )}
          </div>
          <p className={`
            text-xs mt-1 truncate
            ${isInSelected ? 'text-purple-700' : 'text-gray-600'}
          `}>
            {field.description}
          </p>
          <div className={`
            text-xs font-mono mt-1 px-2 py-0.5 rounded inline-block
            ${isInSelected 
              ? 'bg-purple-200 text-purple-800' 
              : 'bg-gray-200 text-gray-700'
            }
          `}>
            {field.id}
          </div>
        </div>
      </div>
      
      {/* Drag handle indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-1 h-1 bg-gray-400 rounded-full"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Droppable Zone Component
function DroppableZone({ children, title, description, isEmpty = false }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center space-x-2 mb-4">
        <ClipboardDocumentListIcon className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      
      <div className={`
        flex-1 border-2 border-dashed rounded-xl p-4 transition-all duration-300
        ${isEmpty 
          ? 'border-gray-300 bg-gray-50/50' 
          : 'border-purple-300 bg-purple-50/50'
        }
        hover:border-purple-400 hover:bg-purple-50
      `}>
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <Squares2X2Icon className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-500 font-medium">Arraste campos aqui</p>
            <p className="text-sm text-gray-400 mt-1">
              Os campos selecionados aparecerão no webhook
            </p>
          </div>
        ) : (
          <div className="space-y-3 h-full overflow-y-auto">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WebhookManager({ sessionId, tokenId, onClose }) {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [activeId, setActiveId] = useState(null);
  
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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

    // Check if field is being dropped in selected area
    if (over.id === 'selected-fields' || over.data?.current?.type === 'selected') {
      // Add field to selected if not already there
      if (!webhookForm.selectedFields.includes(activeField.id)) {
        setWebhookForm(prev => ({
          ...prev,
          selectedFields: [...prev.selectedFields, activeField.id]
        }));
      }
    } else if (over.id === 'available-fields' || over.data?.current?.type === 'available') {
      // Remove field from selected
      setWebhookForm(prev => ({
        ...prev,
        selectedFields: prev.selectedFields.filter(id => id !== activeField.id)
      }));
    } else if (over.data?.current?.type === 'field') {
      // Reordering within selected fields
      const oldIndex = webhookForm.selectedFields.indexOf(active.id);
      const newIndex = webhookForm.selectedFields.indexOf(over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
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
            borderRadius: '24px',
            margin: '16px',
            height: 'calc(100vh - 32px)',
          }}
        >
          {/* Modern Header */}
          <div className="sticky top-0 bg-gradient-to-r from-white/95 via-white/90 to-gray-50/95 backdrop-blur-xl border-b border-gray-200/50 px-6 md:px-8 py-6 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                  <LinkIcon className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Webhook Manager
                  </h2>
                  <p className="text-gray-600 font-medium">Sessão: {sessionId}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreateModal(true)}
                  disabled={webhooks.length >= 3}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg font-medium"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  Novo Webhook
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center justify-center shadow-lg"
                >
                  <XCircleIcon className="h-6 w-6 text-white" />
                </motion.button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8">
            {/* Modern Webhooks Grid */}
            <div className="grid gap-6">
              {webhooks.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-16"
                >
                  <div className="inline-flex p-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-3xl mb-6">
                    <LinkIcon className="h-16 w-16 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Nenhum webhook configurado
                  </h3>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    Configure webhooks para receber eventos em tempo real do WhatsApp
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-2xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg font-medium"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Criar Primeiro Webhook
                  </motion.button>
                </motion.div>
              ) : (
                webhooks.map((webhook, index) => (
                  <motion.div
                    key={webhook.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-200/50 hover:border-gray-300/50 transition-all duration-500 shadow-xl hover:shadow-2xl"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                          <h3 className="text-2xl font-bold text-gray-900">
                            {webhook.name || 'Webhook'}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(
                              webhook.active
                            )}`}
                          >
                            {webhook.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold border ${getPriorityColor(
                              webhook.priority
                            )}`}
                          >
                            Prioridade {webhook.priority}
                          </span>
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                              webhook.version === 'v2'
                                ? 'text-purple-700 bg-purple-50 border-purple-200'
                                : 'text-gray-700 bg-gray-50 border-gray-200'
                            }`}
                          >
                            {webhook.version === 'v2' ? 'Webhook v2' : 'Webhook v1'}
                          </span>
                        </div>

                        <div className="space-y-4 text-sm">
                          <div className="flex items-center space-x-3">
                            <span className="font-semibold text-gray-700 w-20">
                              URL:
                            </span>
                            <span className="font-mono bg-gray-100 px-3 py-2 rounded-lg text-sm text-gray-800 break-all flex-1">
                              {webhook.url}
                            </span>
                          </div>
                          
                          <div className="flex items-start space-x-3">
                            <span className="font-semibold text-gray-700 w-20 mt-1">
                              Eventos:
                            </span>
                            <div className="flex flex-wrap gap-2 flex-1">
                              {webhook.events.map((event, index) => {
                                const EventIcon = getEventIcon(event);
                                return (
                                  <span
                                    key={index}
                                    className={`px-3 py-1 rounded-lg text-sm border flex items-center gap-2 font-medium ${getEventColor(
                                      event
                                    )}`}
                                    title={
                                      availableEvents.find((e) => e.id === event)
                                        ?.description || event
                                    }
                                  >
                                    <EventIcon className="h-4 w-4" />
                                    {getEventName(event)}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <span className="font-semibold text-gray-700 w-20">
                              Grupos:
                            </span>
                            <span
                              className={`px-3 py-1 rounded-lg text-sm border font-medium ${
                                webhook.ignoreGroups
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-green-50 text-green-700 border-green-200'
                              }`}
                            >
                              {webhook.ignoreGroups ? 'Ignorados' : 'Incluídos'}
                            </span>
                          </div>
                          
                          {testResults[webhook.id] && (
                            <div className="flex items-center space-x-3">
                              <span className="font-semibold text-gray-700 w-20">
                                Teste:
                              </span>
                              <span
                                className={`px-3 py-1 rounded-lg text-sm border font-medium ${
                                  testResults[webhook.id].success
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-red-50 text-red-700 border-red-200'
                                }`}
                              >
                                {testResults[webhook.id].success ? 'Sucesso' : 'Falha'}
                                ({testResults[webhook.id].status})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-6">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => testWebhook(webhook.id)}
                          disabled={testingWebhook === webhook.id}
                          className="p-3 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors disabled:opacity-50 border border-purple-200 shadow-sm"
                          title="Testar webhook"
                        >
                          {testingWebhook === webhook.id ? (
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                          ) : (
                            <BoltIcon className="h-5 w-5" />
                          )}
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => toggleWebhook(webhook.id)}
                          className={`p-3 rounded-xl transition-colors border shadow-sm ${
                            webhook.active
                              ? 'text-yellow-600 hover:bg-yellow-50 border-yellow-200'
                              : 'text-green-600 hover:bg-green-50 border-green-200'
                          }`}
                          title={webhook.active ? 'Desativar' : 'Ativar'}
                        >
                          {webhook.active ? (
                            <PauseIcon className="h-5 w-5" />
                          ) : (
                            <PlayIcon className="h-5 w-5" />
                          )}
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => startEdit(webhook)}
                          className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-blue-200 shadow-sm"
                          title="Editar"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => deleteWebhook(webhook.id)}
                          className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-200 shadow-sm"
                          title="Remover"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer Info */}
            {webhooks.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200/50 shadow-lg"
              >
                <div className="flex items-center">
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 mr-3" />
                  <span className="text-yellow-700 font-medium">
                    Máximo de 3 webhooks por sessão. {3 - webhooks.length} restante(s).
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Create/Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || editingWebhook) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60]"
            onClick={() => {
              setShowCreateModal(false);
              setEditingWebhook(null);
              resetForm();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-white via-white to-gray-50/50 backdrop-blur-xl border border-gray-200/50 w-full h-full flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{
                borderRadius: '24px',
                margin: '16px',
                height: 'calc(100vh - 32px)',
              }}
            >
              {/* Modern Header */}
              <div className="sticky top-0 bg-gradient-to-r from-white/95 via-white/90 to-gray-50/95 backdrop-blur-xl border-b border-gray-200/50 px-8 py-6 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-lg">
                      {editingWebhook ? (
                        <PencilIcon className="h-6 w-6 text-white" />
                      ) : (
                        <PlusIcon className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      {editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}
                    </h3>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingWebhook(null);
                      resetForm();
                    }}
                    className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center justify-center shadow-lg"
                  >
                    <XCircleIcon className="h-6 w-6 text-white" />
                  </motion.button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <div className="space-y-8">
                  {/* Basic Configuration */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <h4 className="text-xl font-semibold text-gray-900 flex items-center">
                      <CogIcon className="h-5 w-5 mr-2 text-blue-600" />
                      Configuração Básica
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
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
                          className="w-full px-4 py-4 bg-white border border-gray-300 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:outline-none focus:border-purple-500 transition-all shadow-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
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
                          className="w-full px-4 py-4 bg-white border border-gray-300 rounded-2xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none focus:border-purple-500 transition-all shadow-sm"
                        >
                          <option value={1}>1 - Alta</option>
                          <option value={2}>2 - Média</option>
                          <option value={3}>3 - Baixa</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
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
                        className="w-full px-4 py-4 bg-white border border-gray-300 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:outline-none focus:border-purple-500 transition-all shadow-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
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
                        className="w-full px-4 py-4 bg-white border border-gray-300 rounded-2xl text-gray-900 focus:ring-2 focus:ring-purple-500 focus:outline-none focus:border-purple-500 transition-all shadow-sm"
                      >
                        <option value="v1">v1 - Webhook Original</option>
                        <option value="v2">v2 - Webhook Avançado (Baileys Enhanced)</option>
                      </select>
                      <p className="text-sm text-gray-600 mt-2 bg-blue-50 p-3 rounded-xl border border-blue-200">
                        <SparklesIcon className="h-4 w-4 inline mr-1 text-blue-600" />
                        v2 oferece estrutura de eventos aprimorada com suporte completo a @lid e drag-and-drop
                      </p>
                    </div>

                    <div className="flex items-center space-x-8">
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
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 bg-white transition-all w-5 h-5"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-700">
                          Webhook ativo
                        </span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={webhookForm.ignoreGroups}
                          onChange={(e) => handleIgnoreGroupsChange(e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 bg-white transition-all w-5 h-5"
                        />
                        <span className="ml-3 text-sm font-medium text-gray-700">
                          Ignorar mensagens de grupos
                        </span>
                      </label>
                    </div>
                  </motion.div>

                  {/* Events Configuration */}
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-6"
                  >
                    <h4 className="text-xl font-semibold text-gray-900 flex items-center">
                      <BoltIcon className="h-5 w-5 mr-2 text-yellow-600" />
                      Eventos para Escutar
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {availableEvents.map((event) => {
                        const EventIcon = event.icon;
                        const isSelected = webhookForm.events.includes(event.id);

                        return (
                          <motion.div
                            key={event.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${
                              isSelected
                                ? 'bg-gradient-to-br from-blue-50 to-purple-50 border-purple-300 shadow-lg'
                                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                            }`}
                            onClick={() => toggleEventSelection(event.id)}
                          >
                            <div className="flex items-start">
                              <div className="flex items-center mr-4">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleEventSelection(event.id)}
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 bg-white transition-all w-5 h-5"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center mb-2">
                                  <EventIcon
                                    className={`h-5 w-5 mr-3 ${
                                      isSelected ? 'text-purple-600' : 'text-gray-500'
                                    }`}
                                  />
                                  <span
                                    className={`text-sm font-semibold ${
                                      isSelected ? 'text-purple-700' : 'text-gray-700'
                                    }`}
                                  >
                                    {event.name}
                                  </span>
                                  <span
                                    className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                                      isSelected
                                        ? getEventColor(event.id)
                                        : 'text-gray-600 bg-gray-100'
                                    }`}
                                  >
                                    {event.category}
                                  </span>
                                </div>
                                <p
                                  className={`text-xs ${
                                    isSelected ? 'text-purple-600' : 'text-gray-600'
                                  }`}
                                >
                                  {event.description}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* Drag and Drop Field Selection for v2 */}
                  {webhookForm.version === 'v2' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center space-x-3">
                        <Squares2X2Icon className="h-6 w-6 text-purple-600" />
                        <h4 className="text-xl font-semibold text-gray-900">
                          Campos do Webhook v2 - Drag & Drop
                        </h4>
                        <div className="px-3 py-1 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 text-sm font-medium rounded-full">
                          Sketchware Style
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-2xl border border-purple-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <EyeIcon className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-700">
                            Como usar:
                          </span>
                        </div>
                        <p className="text-sm text-purple-600">
                          Arraste campos da área "Disponíveis" para "Selecionados" para customizar o payload do webhook.
                          Deixe vazio para enviar payload completo. Reordene arrastando dentro da área selecionada.
                        </p>
                      </div>

                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[500px]">
                          {/* Available Fields */}
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <ClipboardDocumentListIcon className="h-5 w-5 text-gray-600" />
                              <h5 className="text-lg font-semibold text-gray-900">
                                Campos Disponíveis
                              </h5>
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                                {availableFields.filter(f => !webhookForm.selectedFields.includes(f.id) && 
                                  !(webhookForm.ignoreGroups && f.isGroupField)).length} campos
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                              Arraste campos para a área de selecionados
                            </p>
                            
                            <div 
                              className="border-2 border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50/50 min-h-[400px] transition-all duration-300"
                              data-type="available"
                            >
                              <div className="space-y-3">
                                {Object.entries(fieldCategories).map(([categoryId, category]) => {
                                  const categoryFields = availableFields.filter(
                                    field => 
                                      field.category === categoryId && 
                                      !webhookForm.selectedFields.includes(field.id) &&
                                      !(webhookForm.ignoreGroups && field.isGroupField)
                                  );

                                  if (categoryFields.length === 0) return null;

                                  return (
                                    <div key={categoryId} className="space-y-2">
                                      <h6 className={`text-sm font-semibold text-${category.color}-700 px-3 py-1 bg-${category.color}-50 rounded-lg inline-block`}>
                                        {category.name}
                                      </h6>
                                      <div className="grid grid-cols-1 gap-2">
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
                            </div>
                          </div>

                          {/* Selected Fields */}
                          <div className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <ClipboardDocumentListIcon className="h-5 w-5 text-purple-600" />
                              <h5 className="text-lg font-semibold text-gray-900">
                                Campos Selecionados
                              </h5>
                              <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full font-medium">
                                {webhookForm.selectedFields.length} campos
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                              {webhookForm.selectedFields.length === 0 
                                ? 'Payload completo será enviado' 
                                : 'Apenas estes campos serão enviados'
                              }
                            </p>
                            
                            <SortableContext
                              items={webhookForm.selectedFields}
                              strategy={verticalListSortingStrategy}
                            >
                              <div 
                                className={`border-2 border-dashed rounded-2xl p-4 min-h-[400px] transition-all duration-300 ${
                                  webhookForm.selectedFields.length === 0
                                    ? 'border-gray-300 bg-gray-50/50'
                                    : 'border-purple-300 bg-purple-50/50'
                                }`}
                                data-type="selected"
                              >
                                {webhookForm.selectedFields.length === 0 ? (
                                  <div className="h-full flex flex-col items-center justify-center text-center py-16">
                                    <Squares2X2Icon className="h-16 w-16 text-gray-400 mb-4" />
                                    <p className="text-gray-500 font-medium text-lg">Arraste campos aqui</p>
                                    <p className="text-sm text-gray-400 mt-2">
                                      Os campos selecionados aparecerão no webhook
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
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
                              </div>
                            </SortableContext>
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

                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-2xl border border-purple-200">
                        <div className="flex items-center space-x-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-purple-600" />
                          <span className="text-sm font-semibold text-purple-700">
                            Status da Seleção:
                          </span>
                          <span className="text-sm text-purple-600">
                            {webhookForm.selectedFields.length === 0
                              ? 'Payload completo será enviado (todos os campos)'
                              : `${webhookForm.selectedFields.length} campo(s) selecionado(s) - payload customizado`}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Modern Footer */}
              <div className="sticky bottom-0 bg-gradient-to-r from-white/95 via-white/90 to-gray-50/95 backdrop-blur-xl border-t border-gray-200/50 px-8 py-6 z-10">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex gap-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (editingWebhook) {
                        updateWebhook(editingWebhook);
                      } else {
                        createWebhook();
                      }
                    }}
                    disabled={!webhookForm.url}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-2xl hover:from-purple-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg font-semibold text-lg"
                  >
                    {editingWebhook ? 'Atualizar Webhook' : 'Criar Webhook'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingWebhook(null);
                      resetForm();
                    }}
                    className="flex-1 py-4 px-6 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-2xl hover:from-gray-200 hover:to-gray-300 transition-all duration-300 shadow-lg font-semibold text-lg"
                  >
                    Cancelar
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}