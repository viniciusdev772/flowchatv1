import {
  ArrowDownTrayIcon,
  DocumentIcon,
  EyeIcon,
  FilmIcon,
  FolderIcon,
  MusicalNoteIcon,
  PhotoIcon,
  XMarkIcon,
  WifiIcon,
  SignalIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';

export default function MediaManager({ onClose }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Performance mode detection
  const [performanceMode] = useState(() => {
    const isLowEnd =
      navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const isSlowConnection =
      navigator.connection &&
      (navigator.connection.effectiveType === 'slow-2g' ||
        navigator.connection.effectiveType === '2g' ||
        navigator.connection.effectiveType === '3g');
    const isOldBrowser = !CSS.supports('backdrop-filter', 'blur(1px)');
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    return isLowEnd || isSlowConnection || isOldBrowser || isMobile;
  });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/management/media/sessions`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSessions(result.sessions || []);
          // Auto-select first session if available
          if (result.sessions && result.sessions.length > 0) {
            setSelectedSession(result.sessions[0].sessionId);
            loadSessionMedia(result.sessions[0].sessionId);
          }
        }
      }
    } catch (error) {
      console.error('Error loading media sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessionMedia = async (sessionId) => {
    try {
      setMediaLoading(true);
      const response = await fetch(`${apiUrl}/api/management/media/session/${sessionId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMedia(result.media || []);
        }
      }
    } catch (error) {
      console.error('Error loading session media:', error);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleSessionSelect = (sessionId) => {
    setSelectedSession(sessionId);
    loadSessionMedia(sessionId);
  };

  const handleDownload = async (mediaFile) => {
    try {
      const response = await fetch(
        `${apiUrl}/api/management/media/download/${selectedSession}/${encodeURIComponent(mediaFile.filename)}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = mediaFile.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading media:', error);
    }
  };

  const handlePreview = (mediaFile) => {
    if (mediaFile.type === 'image' && mediaFile.previewUrl) {
      setSelectedMedia(mediaFile);
      setShowPreview(true);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getMediaIcon = (type) => {
    switch (type) {
      case 'image':
        return PhotoIcon;
      case 'video':
        return FilmIcon;
      case 'audio':
        return MusicalNoteIcon;
      case 'document':
      case 'pdf':
        return DocumentIcon;
      default:
        return DocumentIcon;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'image':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'video':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'audio':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'document':
      case 'pdf':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getSessionStatusIcon = (session) => {
    if (session.sessionId === 'uploads') {
      return <FolderIcon className="w-4 h-4" />;
    }
    
    switch (session.connectionState) {
      case 'connected':
      case true:
        return <CheckCircleIcon className="w-4 h-4 text-green-400" />;
      case 'connecting':
      case 'qr_generated':
        return <ClockIcon className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'disconnected':
      case false:
        return <ExclamationCircleIcon className="w-4 h-4 text-red-400" />;
      default:
        return <SignalIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  const getSessionStatusColor = (session) => {
    if (session.sessionId === 'uploads') {
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
    
    if (session.isConnected === true || session.connectionState === 'connected') {
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    } else if (session.connectionState === 'connecting' || session.connectionState === 'qr_generated') {
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    } else {
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          className="bg-card border rounded-lg shadow-sm p-8 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <PhotoIcon className="w-8 h-8 text-foreground animate-pulse" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Carregando Mídias
          </h2>
          <p className="text-muted-foreground">
            Buscando arquivos de mídia das suas sessões...
          </p>
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        className="bg-card border rounded-lg mx-2 md:mx-4 mt-2 md:mt-4 mb-4 md:mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="px-3 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <PhotoIcon className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Gerenciar Mídia
                </h1>
                <p className="text-sm text-muted-foreground">
                  Visualize e baixe arquivos de mídia das suas sessões
                </p>
              </div>
            </div>
            <motion.button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              whileHover={performanceMode ? {} : { scale: 1.05 }}
              whileTap={performanceMode ? {} : { scale: 0.95 }}
              title="Fechar"
            >
              <XMarkIcon className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      <div className="flex flex-col lg:flex-row mx-2 md:mx-4 mb-4 gap-4">
        {/* Sessions Sidebar */}
        <motion.nav
          className="lg:w-80 bg-card border rounded-lg p-4"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <FolderIcon className="w-5 h-5 mr-2" />
            Sessões com Mídia
          </h3>
          
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <PhotoIcon className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
              <h4 className="text-sm font-medium text-foreground mb-2">
                Nenhuma mídia encontrada
              </h4>
              <p className="text-xs text-muted-foreground">
                Envie algumas mídias via WhatsApp para visualizá-las aqui
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <motion.button
                  key={session.sessionId}
                  onClick={() => handleSessionSelect(session.sessionId)}
                  className={`w-full p-3 rounded-lg transition-all border ${
                    selectedSession === session.sessionId
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30'
                      : 'hover:bg-white/5 border-transparent hover:border-white/10'
                  }`}
                  whileHover={performanceMode ? {} : { scale: 1.01 }}
                  whileTap={performanceMode ? {} : { scale: 0.99 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        {session.sessionId === 'uploads' ? 
                          <FolderIcon className="w-4 h-4 text-foreground" /> :
                          <WifiIcon className="w-4 h-4 text-foreground" />
                        }
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-foreground text-sm">
                          {session.sessionName || session.sessionId}
                        </div>
                        {session.sessionId !== 'uploads' && (
                          <div className={`flex items-center space-x-1 text-xs ${getSessionStatusColor(session).replace('bg-', '').replace('/20', '').replace('border-', '').replace('/30', '')}`}>
                            {getSessionStatusIcon(session)}
                            <span>
                              {session.isConnected === true ? 'Conectado' : 
                               session.connectionState === 'connecting' ? 'Conectando' :
                               session.connectionState === 'qr_generated' ? 'QR Gerado' : 'Desconectado'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={`${getTypeColor('image')} text-xs`}>
                      {session.mediaCount}
                    </Badge>
                  </div>
                  
                  {/* Session info */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    {session.latestMediaAt && (
                      <div className="flex items-center space-x-1">
                        <ClockIcon className="w-3 h-3" />
                        <span>Último arquivo: {formatDate(session.latestMediaAt)}</span>
                      </div>
                    )}
                    {session.lastActivity && session.sessionId !== 'uploads' && (
                      <div className="flex items-center space-x-1">
                        <SignalIcon className="w-3 h-3" />
                        <span>Atividade: {formatDate(session.lastActivity)}</span>
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </motion.nav>

        {/* Media Grid */}
        <motion.main
          className="flex-1 bg-card border rounded-lg p-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {selectedSession ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {sessions.find(s => s.sessionId === selectedSession)?.sessionName || selectedSession}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                    <span>{media.length} arquivos</span>
                    {media.length > 0 && (
                      <span>{formatFileSize(media.reduce((sum, file) => sum + (file.size || 0), 0))}</span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => loadSessionMedia(selectedSession)}
                  disabled={mediaLoading}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {mediaLoading ? 'Carregando...' : 'Atualizar'}
                </Button>
              </div>

              {mediaLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Carregando mídia...</p>
                </div>
              ) : media.length === 0 ? (
                <div className="text-center py-12">
                  <PhotoIcon className="w-16 h-16 text-foreground/30 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-foreground mb-2">
                    Nenhuma mídia encontrada
                  </h4>
                  <p className="text-muted-foreground">
                    Esta sessão ainda não possui arquivos de mídia
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {media.map((mediaFile) => {
                    const Icon = getMediaIcon(mediaFile.type);
                    return (
                      <motion.div
                        key={mediaFile.filename}
                        className="bg-card border rounded-lg p-4 hover:shadow-lg transition-all"
                        whileHover={performanceMode ? {} : { scale: 1.02 }}
                        whileTap={performanceMode ? {} : { scale: 0.98 }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-foreground" />
                          </div>
                          <Badge className={`${getTypeColor(mediaFile.type)} text-xs`}>
                            {mediaFile.type}
                          </Badge>
                        </div>

                        <div className="mb-3">
                          <h4 className="font-medium text-foreground text-sm mb-1 truncate" title={mediaFile.originalFileName || mediaFile.filename}>
                            {mediaFile.originalFileName || mediaFile.filename}
                          </h4>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between">
                              <span>{formatFileSize(mediaFile.size)}</span>
                              <span>{formatDate(mediaFile.createdAt)}</span>
                            </div>
                            {mediaFile.source === 'whatsapp' && (
                              <div className="flex items-center justify-between">
                                <span className="text-blue-400">WhatsApp</span>
                                {mediaFile.isPtt && (
                                  <span className="text-green-400">Áudio PTT</span>
                                )}
                              </div>
                            )}
                            {mediaFile.mimetype && mediaFile.mimetype !== 'unknown' && (
                              <div className="text-gray-400 truncate" title={mediaFile.mimetype}>
                                {mediaFile.mimetype}
                              </div>
                            )}
                            {!mediaFile.fileExists && (
                              <div className="text-red-400 text-xs">
                                ⚠ Arquivo não encontrado
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {mediaFile.type === 'image' && mediaFile.fileExists !== false && (
                            <Button
                              onClick={() => handlePreview(mediaFile)}
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                            >
                              <EyeIcon className="w-3 h-3 mr-1" />
                              Preview
                            </Button>
                          )}
                          <Button
                            onClick={() => handleDownload(mediaFile)}
                            size="sm"
                            disabled={mediaFile.fileExists === false}
                            className={`flex-1 text-xs ${
                              mediaFile.fileExists === false
                                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                          >
                            <ArrowDownTrayIcon className="w-3 h-3 mr-1" />
                            {mediaFile.fileExists === false ? 'Indisponível' : 'Baixar'}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <FolderIcon className="w-16 h-16 text-foreground/30 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-foreground mb-2">
                Selecione uma Sessão
              </h4>
              <p className="text-muted-foreground">
                Escolha uma sessão na barra lateral para visualizar suas mídias
              </p>
            </div>
          )}
        </motion.main>
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedMedia?.filename}</DialogTitle>
            <DialogDescription>
              {selectedMedia && formatFileSize(selectedMedia.size)} • {selectedMedia && new Date(selectedMedia.createdAt).toLocaleDateString('pt-BR')}
            </DialogDescription>
          </DialogHeader>
          {selectedMedia && (
            <div className="mt-4">
              <img
                src={`${apiUrl}/api/management/media/preview/${selectedSession}/${encodeURIComponent(selectedMedia.filename)}`}
                alt={selectedMedia.filename}
                className="w-full h-auto max-h-96 object-contain rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="mt-4 flex justify-center">
                <Button
                  onClick={() => handleDownload(selectedMedia)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                  Baixar Arquivo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}