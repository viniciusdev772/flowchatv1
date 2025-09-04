import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { EyeIcon, EyeSlashIcon, UserIcon, EnvelopeIcon, LockClosedIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl, apiRequest } from '../utils/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [csrfLoading, setCsrfLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, reset } = useForm();

  const password = watch('password');


  const checkPasswordRequirements = (password) => {
    if (!password) return {};

    return {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    };
  };

  const passwordRequirements = checkPasswordRequirements(password);


  useEffect(() => {
    const fetchCSRFToken = async () => {
      setCsrfLoading(true);
      try {
        const response = await apiRequest('/api/management/auth/csrf-token', {
          method: 'GET'
        });

        if (response.ok) {
          const result = await response.json();
          setCsrfToken(result.csrfToken);
          console.log('✅ Token CSRF obtido com sucesso');
        } else {
          console.error('Erro ao obter token CSRF:', response.status);
          setApiError('Erro ao inicializar segurança da página');
        }
      } catch (error) {
        console.error('Não foi possível obter token CSRF:', error);
        setApiError('Erro de conexão com o servidor');
      } finally {
        setCsrfLoading(false);
      }
    };


    fetchCSRFToken();
  }, []);

  const onSubmit = async (data) => {
    setApiError('');
    setApiSuccess('');
    setValidationErrors({});


    if (!csrfToken) {
      setApiError('Token de segurança não encontrado. Recarregue a página.');
      return;
    }

    try {
      if (isLogin) {

        const response = await apiRequest('/api/management/auth/login', {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            remember: data.remember || false
          }),
        });

        const result = await response.json();

        if (result.success) {


          sessionStorage.setItem('user', JSON.stringify(result.data.user));

          setApiSuccess('Login realizado com sucesso!');
          console.log('User logged in:', result.data.user);


          if (result.newCsrfToken) {
            setCsrfToken(result.newCsrfToken);
            console.log('🔄 Token CSRF atualizado');
          }


          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1500);
        } else {

          if (result.rateLimitInfo) {
            const { rateLimitInfo } = result;
            let message = result.message;


            if (rateLimitInfo.persistedToDB) {
              message += ' 💾 [Bloqueio salvo permanentemente]';
            }

            if (rateLimitInfo.escalated) {
              setApiError(`🚨 BLOQUEIO ESCALADO! Penalização aumentada para o nível ${rateLimitInfo.penaltyLevel}. Tentativas totais: ${rateLimitInfo.totalAttempts}. ${message}`);
            } else if (rateLimitInfo.penaltyLevel > 0) {
              setApiError(`⚠️ SISTEMA DE PENALIZAÇÃO ATIVO! Nível ${rateLimitInfo.penaltyLevel}. ${message}`);
            } else {
              setApiError(message);
            }


            console.warn('Rate Limit Info:', rateLimitInfo);
          } else {
            setApiError(result.message || 'Erro no login');
          }


          if (result.error && (result.error.includes('CSRF') || result.error.includes('SECURITY'))) {
            console.log('🔄 Tentando recarregar token CSRF...');

            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        }
      } else {

        const response = await apiRequest('/api/management/auth/register', {
          method: 'POST',
          headers: {
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            password: data.password
          }),
        });

        const result = await response.json();

        if (result.success) {


          sessionStorage.setItem('user', JSON.stringify(result.data.user));

          setApiSuccess('Conta criada com sucesso!');
          console.log('User registered:', result.data.user);


          if (result.newCsrfToken) {
            setCsrfToken(result.newCsrfToken);
            console.log('🔄 Token CSRF atualizado');
          }


          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1500);
        } else {

          if (result.validationErrors && Array.isArray(result.validationErrors)) {
            const fieldErrors = {};
            result.validationErrors.forEach(error => {
              const field = error.path || error.param;
              if (field) {
                fieldErrors[field] = error.msg || error.message;
              }
            });
            setValidationErrors(fieldErrors);


            setApiError('Por favor, corrija os erros nos campos destacados.');
          } else {
            setApiError(result.message || 'Erro no registro');
          }


          if (result.error && (result.error.includes('CSRF') || result.error.includes('SECURITY'))) {
            console.log('🔄 Tentando recarregar token CSRF...');

            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        }
      }
    } catch (error) {
      console.error('Auth error:', error);


      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setApiError('🔌 Erro de conexão com o servidor. Verifique se o backend está rodando.');
      }

      else if (error.message && error.message.toLowerCase().includes('cors')) {
        setApiError('🌐 Erro de CORS. Verifique a configuração do servidor.');
      }

      else if (error.response && error.response.status === 429) {
        setApiError('🚨 Muitas tentativas detectadas. Sistema de proteção ativado.');
      }

      else {
        setApiError('❌ Erro de conexão com o servidor. Tente novamente.');
      }
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    reset();
    setShowPassword(false);
    setShowConfirmPassword(false);
    setApiError('');
    setApiSuccess('');
    setValidationErrors({});


    if (!csrfToken && !csrfLoading) {
      setCsrfLoading(true);
      const fetchCSRFToken = async () => {
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          const response = await fetch(`${apiUrl}/api/management/auth/csrf-token`, {
            method: 'GET',
            credentials: 'include'
          });

          if (response.ok) {
            const result = await response.json();
            setCsrfToken(result.csrfToken);
            console.log('✅ Token CSRF recarregado ao trocar modo');
          }
        } catch (error) {
          console.error('Erro ao recarregar token CSRF:', error);
        } finally {
          setCsrfLoading(false);
        }
      };
      fetchCSRFToken();
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {}
      {import.meta.env.DEV && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          <div className="bg-black/80 text-white px-3 py-2 rounded-lg text-xs font-mono">
            CSRF: {csrfLoading ? (
              <span className="text-yellow-400">Carregando...</span>
            ) : csrfToken ? (
              <span className="text-green-400">✓ Ativo</span>
            ) : (
              <span className="text-red-400">✗ Erro</span>
            )}
          </div>

        </div>
      )}

      {}
      <motion.div
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative bg-gradient-to-br from-green-600 via-blue-700 to-purple-900 flex-col justify-center items-center p-12"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {}
        <div className="absolute inset-0 overflow-hidden">
          {}
          <motion.div
            className="absolute top-20 left-20 w-32 h-32 bg-green-400/20 rounded-full flex items-center justify-center"
            animate={{
              y: [0, -20, 0],
              x: [0, 10, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <ChatBubbleLeftRightIcon className="w-16 h-16 text-white/30" />
          </motion.div>

          <motion.div
            className="absolute bottom-40 right-16 w-24 h-24 bg-blue-400/20 rounded-2xl rotate-45 flex items-center justify-center"
            animate={{
              rotate: [45, 135, 45],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="w-12 h-12 bg-white/20 rounded-lg -rotate-45"></div>
          </motion.div>

          <motion.div
            className="absolute top-1/3 right-1/4 w-16 h-16 bg-purple-400/30 rounded-full flex items-center justify-center"
            animate={{
              y: [0, 30, 0],
              x: [0, -15, 0],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div className="w-2 h-2 bg-white/50 rounded-full"></div>
          </motion.div>

          {}
          <motion.div
            className="absolute top-32 left-1/3 w-20 h-20 border-2 border-white/10 rounded-full"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <motion.div
            className="absolute bottom-32 left-1/4 w-16 h-16 border-2 border-green-400/20 rounded-lg rotate-12"
            animate={{
              rotate: [12, 48, 12],
              borderColor: ['rgba(74, 222, 128, 0.2)', 'rgba(59, 130, 246, 0.2)', 'rgba(74, 222, 128, 0.2)'],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 600">
            <motion.path
              d="M50,100 Q200,50 350,150 T300,400"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="2"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
            />
            <motion.path
              d="M100,200 Q250,150 400,250 T350,500"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 4, repeat: Infinity, repeatType: "reverse", delay: 1 }}
            />
          </svg>
        </div>

        {}
        <div className="relative z-10 text-center max-w-md">
          <motion.div
            className="mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="w-20 h-20 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
              <ChatBubbleLeftRightIcon className="w-10 h-10 text-white" />
            </div>
          </motion.div>

          <motion.h1
            className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            FlowChat API
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-blue-400 to-purple-400">
              Fluxo Inteligente
            </span>
          </motion.h1>

          <motion.p
            className="text-sm sm:text-base lg:text-lg xl:text-xl text-white/80 mb-6 sm:mb-8 leading-relaxed"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            API avançada de WhatsApp com fluxo contínuo de mensagens. Multi-sessões, webhooks
            inteligentes e automação segura para sua aplicação.
          </motion.p>

          <motion.div
            className="flex flex-col items-center space-y-4"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            {}
            <div className="flex justify-center space-x-6 text-center">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center mb-2">
                  <div className="w-4 h-4 bg-green-400 rounded-full"></div>
                </div>
                <span className="text-xs text-white/70">Multi-Sessão</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mb-2">
                  <div className="w-4 h-4 bg-blue-400 rounded-full"></div>
                </div>
                <span className="text-xs text-white/70">Webhooks</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mb-2">
                  <div className="w-4 h-4 bg-purple-400 rounded-full"></div>
                </div>
                <span className="text-xs text-white/70">Anti-Ban</span>
              </div>
            </div>

            {}
            <div className="flex justify-center space-x-2">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 bg-white/40 rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.4, 0.8, 0.4],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.3,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {}
      <motion.div
        className="w-full lg:w-1/2 xl:w-2/5 bg-white flex flex-col justify-center px-4 xs:px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 py-8 sm:py-12 relative min-h-screen lg:min-h-0"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-br from-green-600 via-blue-700 to-purple-900 opacity-95" />

        {}
        <div className="hidden lg:block absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute top-16 right-8 w-6 h-6 bg-blue-500/20 rounded-full"
            animate={{
              y: [0, -10, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-32 right-16 w-4 h-4 bg-purple-500/20 rounded-full"
            animate={{
              y: [0, 15, 0],
              x: [0, -8, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />
        </div>

        <div className="relative z-10 w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto lg:mx-0">
          {}
          <div className="mb-6 sm:mb-8">
            <motion.div
              className="lg:hidden mb-4 sm:mb-6 text-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <ChatBubbleLeftRightIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login' : 'register'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl font-bold text-white lg:text-gray-900 mb-3 sm:mb-4">
                  {isLogin ? 'Entrar' : 'Criar Conta'}
                </h2>
                <p className="text-base sm:text-lg md:text-xl lg:text-base xl:text-lg text-white/80 lg:text-gray-600">
                  {isLogin
                    ? 'Acesse sua conta e gerencie seus fluxos de mensagens'
                    : 'Crie sua conta e automatize seu fluxo de comunicação'
                  }
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {}
            <AnimatePresence>
              {apiError && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className={`p-3 sm:p-4 rounded-xl backdrop-blur-sm border ${
                    apiError.includes('🚨') || apiError.includes('BLOQUEIO') || apiError.includes('PENALIZAÇÃO')
                      ? 'bg-red-600/20 border-red-500/40 shadow-red-500/20 shadow-lg'
                      : 'bg-red-500/10 border-red-500/20'
                  }`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {apiError.includes('🚨') || apiError.includes('BLOQUEIO') ? (
                        <motion.div
                          animate={{
                            scale: [1, 1.2, 1],
                            rotate: [0, 5, -5, 0]
                          }}
                          transition={{
                            duration: 0.5,
                            repeat: Infinity,
                            repeatType: "reverse"
                          }}
                        >
                          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </motion.div>
                      ) : (
                        <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${
                        apiError.includes('🚨') || apiError.includes('BLOQUEIO') || apiError.includes('PENALIZAÇÃO')
                          ? 'text-red-400'
                          : 'text-red-500'
                      }`}>
                        {apiError}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {}
            <AnimatePresence>
              {apiSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="p-3 sm:p-4 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm"
                >
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-green-500 font-medium">{apiSuccess}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login-form' : 'register-form'}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4 sm:space-y-5"
              >
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <label htmlFor="name" className="block text-xs xs:text-sm font-semibold text-white lg:text-gray-700 mb-1 sm:mb-2">
                      Nome completo
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        {...register('name', {
                          required: !isLogin ? 'Nome é obrigatório' : false,
                          minLength: {
                            value: 2,
                            message: 'Nome deve ter pelo menos 2 caracteres'
                          },
                          pattern: {
                            value: /^[a-zA-ZÀ-ÿ\s]+$/,
                            message: 'Nome deve conter apenas letras e espaços'
                          }
                        })}
                        type="text"
                        className={`pl-10 ${validationErrors.name ? 'border-red-500 bg-red-50/10' : ''}`}
                        placeholder="Digite seu nome completo"
                      />
                    </div>
                    {(errors.name || validationErrors.name) && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-sm text-red-400"
                      >
                        {errors.name?.message || validationErrors.name}
                      </motion.p>
                    )}
                  </motion.div>
                )}

                <div>
                  <label htmlFor="email" className="block text-xs xs:text-sm font-semibold text-white lg:text-gray-700 mb-1 sm:mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      {...register('email', {
                        required: 'Email é obrigatório',
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: 'Formato de email inválido'
                        }
                      })}
                      type="email"
                      className={`pl-10 ${validationErrors.email ? 'border-red-500 bg-red-50/10' : ''}`}
                      placeholder="Digite seu email"
                    />
                  </div>
                  {(errors.email || validationErrors.email) && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-sm text-red-400"
                    >
                      {errors.email?.message || validationErrors.email}
                    </motion.p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs xs:text-sm font-semibold text-white lg:text-gray-700 mb-1 sm:mb-2">
                    Senha
                  </label>
                  <div className="relative">
                    <LockClosedIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      {...register('password', {
                        required: 'Senha é obrigatória',
                        minLength: {
                          value: isLogin ? 1 : 8,
                          message: isLogin ? 'Senha é obrigatória' : 'Senha deve ter pelo menos 8 caracteres'
                        },
                        ...(isLogin ? {} : {
                          pattern: {
                            value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                            message: 'Senha deve conter: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial'
                          }
                        })
                      })}
                      type={showPassword ? 'text' : 'password'}
                      className={`pl-10 pr-10 ${validationErrors.password ? 'border-red-500 bg-red-50/10' : ''}`}
                      placeholder="Digite sua senha"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {}
                  {!isLogin && password && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 p-3 bg-white/10 lg:bg-gray-50 rounded-lg border border-white/20 lg:border-gray-200"
                    >
                      <p className="text-xs font-medium text-white/80 lg:text-gray-600 mb-2">Requisitos da senha:</p>
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { key: 'length', label: 'Pelo menos 8 caracteres', met: passwordRequirements.length },
                          { key: 'lowercase', label: 'Uma letra minúscula (a-z)', met: passwordRequirements.lowercase },
                          { key: 'uppercase', label: 'Uma letra maiúscula (A-Z)', met: passwordRequirements.uppercase },
                          { key: 'number', label: 'Um número (0-9)', met: passwordRequirements.number },
                          { key: 'special', label: 'Um caractere especial (@$!%*?&)', met: passwordRequirements.special }
                        ].map((req) => (
                          <div key={req.key} className="flex items-center space-x-2">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              req.met ? 'bg-green-500' : 'bg-white/20 lg:bg-gray-300'
                            }`}>
                              {req.met && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-xs ${
                              req.met ? 'text-green-400 lg:text-green-600' : 'text-white/60 lg:text-gray-500'
                            }`}>
                              {req.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {(errors.password || validationErrors.password) && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-sm text-red-400"
                    >
                      {errors.password?.message || validationErrors.password}
                    </motion.p>
                  )}
                </div>

                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <label htmlFor="confirmPassword" className="block text-xs xs:text-sm font-semibold text-white lg:text-gray-700 mb-1 sm:mb-2">
                      Confirmar senha
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/50 lg:text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input
                        {...register('confirmPassword', {
                          required: !isLogin ? 'Confirmação de senha é obrigatória' : false,
                          validate: value => isLogin || value === password || 'As senhas não coincidem'
                        })}
                        type={showConfirmPassword ? 'text' : 'password'}
                        className={`block w-full pl-10 sm:pl-12 pr-11 sm:pr-14 py-3 sm:py-4 border-2 border-white/30 lg:border-gray-200 bg-white/10 lg:bg-white rounded-xl sm:rounded-2xl text-white lg:text-gray-900 placeholder-white/60 lg:placeholder-gray-400 focus:ring-0 focus:border-blue-500 lg:focus:border-blue-500 focus:bg-white/20 lg:focus:bg-white transition-all duration-200 text-sm sm:text-base lg:text-lg ${
                          validationErrors.confirmPassword ? 'border-red-500 bg-red-50/10' : ''
                        }`}
                        placeholder="Confirme sua senha"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center hover:scale-110 transition-transform"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/60 lg:text-gray-400 hover:text-white/80 lg:hover:text-gray-600" />
                        ) : (
                          <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/60 lg:text-gray-400 hover:text-white/80 lg:hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                    {(errors.confirmPassword || validationErrors.confirmPassword) && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-sm text-red-400"
                      >
                        {errors.confirmPassword?.message || validationErrors.confirmPassword}
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {isLogin ? (
                <motion.div
                  key="login-options"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <input
                      {...register('remember')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-400 focus:ring-blue-400 bg-white/10 border-white/30 rounded"
                    />
                    <label htmlFor="remember" className="ml-2 block text-sm text-white/80">
                      Lembrar-me
                    </label>
                  </div>

                  <div className="text-sm">
                    <a href="#" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                      Esqueceu a senha?
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="register-terms"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex items-start">
                    <input
                      {...register('terms', {
                        required: !isLogin ? 'Você deve aceitar os termos' : false
                      })}
                      type="checkbox"
                      className={`mt-1 h-4 w-4 text-blue-400 focus:ring-blue-400 bg-white/10 border-white/30 rounded ${
                        validationErrors.terms ? 'border-red-500' : ''
                      }`}
                    />
                    <label htmlFor="terms" className="ml-2 block text-sm text-white/80 leading-5">
                      Concordo com os{' '}
                      <a href="#" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                        Termos de Uso
                      </a>{' '}
                      e{' '}
                      <a href="#" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                        Política de Privacidade
                      </a>
                    </label>
                  </div>
                  {(errors.terms || validationErrors.terms) && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-400"
                    >
                      {errors.terms?.message || validationErrors.terms}
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting || csrfLoading || !csrfToken}
              className="relative w-full py-4 sm:py-5 px-6 sm:px-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl sm:rounded-2xl shadow-2xl hover:shadow-blue-500/25 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-base sm:text-lg lg:text-xl overflow-hidden group min-h-[52px] touch-manipulation"
            >
              {}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

              <AnimatePresence mode="wait">
                {csrfLoading ? (
                  <motion.div
                    key="csrf-loading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center justify-center"
                  >
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 border-2 border-white border-t-transparent mr-2 sm:mr-3"></div>
                    Inicializando segurança...
                  </motion.div>
                ) : isSubmitting ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center justify-center"
                  >
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 border-2 border-white border-t-transparent mr-2 sm:mr-3"></div>
                    {isLogin ? 'Acessando...' : 'Configurando sua API...'}
                  </motion.div>
                ) : !csrfToken ? (
                  <motion.span
                    key="csrf-error"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="relative z-10 flex items-center justify-center"
                  >
                    ⚠️ Erro de segurança - Recarregue a página
                  </motion.span>
                ) : (
                  <motion.span
                    key="text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="relative z-10 flex items-center justify-center"
                  >
                    {isLogin ? 'Acessar Dashboard' : 'Começar Agora'}
                    <motion.div
                      className="ml-2"
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      →
                    </motion.div>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            <div className="text-center mt-6 sm:mt-8">
              <p className="text-xs xs:text-sm text-white/80 lg:text-gray-600">
                {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}{' '}
                <motion.button
                  type="button"
                  onClick={toggleMode}
                  className="font-bold text-white lg:text-blue-600 hover:text-white/80 lg:hover:text-blue-700 focus:outline-none underline decoration-white/50 lg:decoration-blue-600/50 underline-offset-2 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isLogin ? 'Criar conta da API' : 'Já tenho acesso'}
                </motion.button>
              </p>
            </div>

            {}
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 p-4 bg-white/5 lg:bg-blue-50 rounded-lg border border-white/20 lg:border-blue-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-400 lg:text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white lg:text-blue-800 mb-2">
                      Dicas para sua conta FlowChat API
                    </h4>
                    <ul className="text-xs text-white/80 lg:text-blue-700 space-y-1">
                      <li>• Use seu nome real para facilitar o suporte</li>
                      <li>• Evite emails temporários (serão rejeitados)</li>
                      <li>• Senha forte protege suas sessões WhatsApp</li>
                      <li>• Aceite os termos para acesso completo à API</li>
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}

            {}
            <div className="mt-6 sm:mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/30 lg:border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs sm:text-sm">
                  <span className="px-3 sm:px-4 bg-white lg:bg-white text-white/70 lg:text-gray-500 font-medium">
                    Ou continue com
                  </span>
                </div>
              </div>

              <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <motion.button
                  type="button"
                  className="flex items-center justify-center py-4 sm:py-4 px-4 sm:px-6 border-2 border-white/30 lg:border-gray-200 rounded-xl sm:rounded-2xl bg-white/10 lg:bg-white text-white lg:text-gray-700 font-medium hover:bg-white/20 lg:hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm sm:text-base min-h-[48px] touch-manipulation"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Google
                </motion.button>

                <motion.button
                  type="button"
                  className="flex items-center justify-center py-4 sm:py-4 px-4 sm:px-6 border-2 border-white/30 lg:border-gray-200 rounded-xl sm:rounded-2xl bg-white/10 lg:bg-white text-white lg:text-gray-700 font-medium hover:bg-white/20 lg:hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-sm sm:text-base min-h-[48px] touch-manipulation"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  GitHub
                </motion.button>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}