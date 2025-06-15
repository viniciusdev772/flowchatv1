import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { EyeIcon, EyeSlashIcon, UserIcon, EnvelopeIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, reset } = useForm();

  const password = watch('password');

  const onSubmit = async (data) => {
    try {
      if (isLogin) {
        console.log('Login data:', data);
        // Add your login logic here
      } else {
        console.log('Register data:', data);
        // Add your register logic here
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    reset(); // Clear form when switching modes
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Left Side - Visual/Branding */}
      <motion.div 
        className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative bg-gradient-to-br from-blue-600 via-purple-700 to-indigo-900 flex-col justify-center items-center p-12"
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Geometric Shapes */}
          <motion.div
            className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full"
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
          />
          <motion.div
            className="absolute bottom-40 right-16 w-24 h-24 bg-yellow-400/20 rounded-lg rotate-45"
            animate={{
              rotate: [45, 135, 45],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute top-1/3 right-1/4 w-16 h-16 bg-pink-400/30 rounded-full"
            animate={{
              y: [0, 30, 0],
              x: [0, -15, 0],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Floating Lines */}
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

        {/* Content */}
        <div className="relative z-10 text-center max-w-md">
          <motion.div
            className="mb-8"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="w-20 h-20 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
              <SparklesIcon className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          
          <motion.h1
            className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            Bem-vindo ao
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400">
              Futuro
            </span>
          </motion.h1>
          
          <motion.p
            className="text-sm sm:text-base lg:text-lg xl:text-xl text-white/80 mb-6 sm:mb-8 leading-relaxed"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            Conecte-se com uma experiência única e revolucionária. 
            Junte-se a milhares de usuários satisfeitos.
          </motion.p>
          
          <motion.div
            className="flex justify-center space-x-4"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-3 h-3 bg-white/40 rounded-full" />
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Form */}
      <motion.div 
        className="w-full lg:w-1/2 xl:w-2/5 bg-white flex flex-col justify-center px-4 xs:px-6 sm:px-8 md:px-10 lg:px-12 xl:px-16 py-8 sm:py-12 relative min-h-screen lg:min-h-0"
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {/* Mobile Background for small screens */}
        <div className="lg:hidden absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-700 to-indigo-900 opacity-95" />
        
        {/* Floating Elements for Right Side */}
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

        <div className="relative z-10 w-full max-w-xs xs:max-w-sm sm:max-w-md mx-auto lg:mx-0">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <motion.div
              className="lg:hidden mb-4 sm:mb-6 text-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <SparklesIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
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
                <h2 className="text-xl xs:text-2xl sm:text-3xl lg:text-3xl xl:text-4xl font-bold text-white lg:text-gray-900 mb-2 sm:mb-3">
                  {isLogin ? 'Entrar' : 'Criar Conta'}
                </h2>
                <p className="text-sm xs:text-base sm:text-lg lg:text-base xl:text-lg text-white/80 lg:text-gray-600">
                  {isLogin 
                    ? 'Acesse sua conta para continuar sua jornada' 
                    : 'Junte-se a nós e comece sua aventura digital'
                  }
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        
          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit(onSubmit)}>
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
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                        <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/50 lg:text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                      </div>
                      <input
                        {...register('name', {
                          required: !isLogin ? 'Nome é obrigatório' : false,
                          minLength: {
                            value: 2,
                            message: 'Nome deve ter pelo menos 2 caracteres'
                          }
                        })}
                        type="text"
                        className="block w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border-2 border-white/30 lg:border-gray-200 bg-white/10 lg:bg-white rounded-xl sm:rounded-2xl text-white lg:text-gray-900 placeholder-white/60 lg:placeholder-gray-400 focus:ring-0 focus:border-blue-500 lg:focus:border-blue-500 focus:bg-white/20 lg:focus:bg-white transition-all duration-200 text-sm sm:text-base lg:text-lg"
                        placeholder="Digite seu nome completo"
                      />
                    </div>
                    {errors.name && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-sm text-red-400"
                      >
                        {errors.name.message}
                      </motion.p>
                    )}
                  </motion.div>
                )}
            
                <div>
                  <label htmlFor="email" className="block text-xs xs:text-sm font-semibold text-white lg:text-gray-700 mb-1 sm:mb-2">
                    Email
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <EnvelopeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/50 lg:text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      {...register('email', {
                        required: 'Email é obrigatório',
                        pattern: {
                          value: /^\S+@\S+$/i,
                          message: 'Email inválido'
                        }
                      })}
                      type="email"
                      className="block w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 border-2 border-white/30 lg:border-gray-200 bg-white/10 lg:bg-white rounded-xl sm:rounded-2xl text-white lg:text-gray-900 placeholder-white/60 lg:placeholder-gray-400 focus:ring-0 focus:border-blue-500 lg:focus:border-blue-500 focus:bg-white/20 lg:focus:bg-white transition-all duration-200 text-sm sm:text-base lg:text-lg"
                      placeholder="Digite seu email"
                    />
                  </div>
                  {errors.email && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-sm text-red-400"
                    >
                      {errors.email.message}
                    </motion.p>
                  )}
                </div>
            
                <div>
                  <label htmlFor="password" className="block text-xs xs:text-sm font-semibold text-white lg:text-gray-700 mb-1 sm:mb-2">
                    Senha
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                      <LockClosedIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/50 lg:text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      {...register('password', {
                        required: 'Senha é obrigatória',
                        minLength: {
                          value: isLogin ? 1 : 6,
                          message: 'Senha deve ter pelo menos 6 caracteres'
                        }
                      })}
                      type={showPassword ? 'text' : 'password'}
                      className="block w-full pl-10 sm:pl-12 pr-11 sm:pr-14 py-3 sm:py-4 border-2 border-white/30 lg:border-gray-200 bg-white/10 lg:bg-white rounded-xl sm:rounded-2xl text-white lg:text-gray-900 placeholder-white/60 lg:placeholder-gray-400 focus:ring-0 focus:border-blue-500 lg:focus:border-blue-500 focus:bg-white/20 lg:focus:bg-white transition-all duration-200 text-sm sm:text-base lg:text-lg"
                      placeholder="Digite sua senha"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center hover:scale-110 transition-transform"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/60 lg:text-gray-400 hover:text-white/80 lg:hover:text-gray-600" />
                      ) : (
                        <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white/60 lg:text-gray-400 hover:text-white/80 lg:hover:text-gray-600" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-sm text-red-400"
                    >
                      {errors.password.message}
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
                        className="block w-full pl-10 sm:pl-12 pr-11 sm:pr-14 py-3 sm:py-4 border-2 border-white/30 lg:border-gray-200 bg-white/10 lg:bg-white rounded-xl sm:rounded-2xl text-white lg:text-gray-900 placeholder-white/60 lg:placeholder-gray-400 focus:ring-0 focus:border-blue-500 lg:focus:border-blue-500 focus:bg-white/20 lg:focus:bg-white transition-all duration-200 text-sm sm:text-base lg:text-lg"
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
                    {errors.confirmPassword && (
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 text-sm text-red-400"
                      >
                        {errors.confirmPassword.message}
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
                      className="mt-1 h-4 w-4 text-blue-400 focus:ring-blue-400 bg-white/10 border-white/30 rounded"
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
                  {errors.terms && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-red-400"
                    >
                      {errors.terms.message}
                    </motion.p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isSubmitting}
              className="relative w-full py-3 sm:py-4 px-4 sm:px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl sm:rounded-2xl shadow-2xl hover:shadow-blue-500/25 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-sm sm:text-base lg:text-lg overflow-hidden group"
            >
              {/* Enhanced shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
              
              <AnimatePresence mode="wait">
                {isSubmitting ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center justify-center"
                  >
                    <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 border-2 border-white border-t-transparent mr-2 sm:mr-3"></div>
                    {isLogin ? 'Entrando...' : 'Criando conta...'}
                  </motion.div>
                ) : (
                  <motion.span
                    key="text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="relative z-10 flex items-center justify-center"
                  >
                    {isLogin ? 'Entrar agora' : 'Criar conta'}
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
                  {isLogin ? 'Cadastre-se gratuitamente' : 'Faça login'}
                </motion.button>
              </p>
            </div>

            {/* Social Login */}
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

              <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                <motion.button
                  type="button"
                  className="flex items-center justify-center py-2.5 sm:py-3 px-3 sm:px-4 border-2 border-white/30 lg:border-gray-200 rounded-xl sm:rounded-2xl bg-white/10 lg:bg-white text-white lg:text-gray-700 font-medium hover:bg-white/20 lg:hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-xs sm:text-sm"
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
                  className="flex items-center justify-center py-2.5 sm:py-3 px-3 sm:px-4 border-2 border-white/30 lg:border-gray-200 rounded-xl sm:rounded-2xl bg-white/10 lg:bg-white text-white lg:text-gray-700 font-medium hover:bg-white/20 lg:hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-xs sm:text-sm"
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