const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const advancedRateLimit = require('../middleware/advancedRateLimit');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nome, email e senha são obrigatórios'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'A senha deve ter pelo menos 6 caracteres'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Formato de email inválido'
        });
      }

      // Check if database is available
      try {
        const db = database.getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        const users = database.getCollection('users');

        // Check if user already exists
        const existingUser = await users.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Já existe um usuário cadastrado com este email'
          });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user document
        const userData = {
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          role: 'user',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLogin: null,
          profile: {
            avatar: null,
            phone: null,
            company: null
          },
          settings: {
            notifications: true,
            darkMode: false,
            language: 'pt-BR'
          },
          stats: {
            totalSessions: 0,
            activeConnections: 0,
            messagesCount: 0
          }
        };

        const result = await users.insertOne(userData);

        // Generate JWT token
        const token = jwt.sign(
          { userId: result.insertedId.toString() },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Set secure HTTP-only cookie
        res.cookie('authToken', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
          signed: true
        });

        // Remove password from response
        delete userData.password;
        userData._id = result.insertedId;

        res.status(201).json({
          success: true,
          message: 'Usuário cadastrado com sucesso',
          data: {
            user: userData
          }
        });

      } catch (dbError) {
        // Development mode without database
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️  Registration in development mode without database');
          
          // Generate mock user
          const mockUserId = '507f1f77bcf86cd799439011';
          const token = jwt.sign(
            { userId: mockUserId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
          );

          // Set secure HTTP-only cookie
          res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            signed: true
          });

          const userData = {
            _id: mockUserId,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            role: 'user',
            active: true,
            createdAt: new Date(),
            profile: { avatar: null, phone: null, company: null },
            settings: { notifications: true, darkMode: false, language: 'pt-BR' },
            stats: { totalSessions: 0, activeConnections: 0, messagesCount: 0 }
          };

          return res.status(201).json({
            success: true,
            message: 'Usuário cadastrado com sucesso (modo desenvolvimento)',
            data: { user: userData }
          });
        }
        throw dbError;
      }

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password, remember } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email e senha são obrigatórios'
        });
      }

      // Check if database is available
      try {
        const db = database.getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        const users = database.getCollection('users');

        // Find user
        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'Credenciais inválidas'
          });
        }

        if (!user.active) {
          return res.status(401).json({
            success: false,
            message: 'Conta desativada'
          });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          // Penalizar falha de login
          try {
            await advancedRateLimit.penalizeFailedLogin(email, req.ip);
          } catch (penaltyError) {
            return res.status(429).json({
              success: false,
              message: 'Conta temporariamente bloqueada devido a múltiplas tentativas de login incorretas'
            });
          }
          
          return res.status(401).json({
            success: false,
            message: 'Credenciais inválidas'
          });
        }

        // Update last login
        await users.updateOne(
          { _id: user._id },
          { $set: { lastLogin: new Date(), updatedAt: new Date() } }
        );

        // Generate JWT token
        const expiresIn = remember ? '30d' : process.env.JWT_EXPIRES_IN;
        const token = jwt.sign(
          { userId: user._id.toString() },
          process.env.JWT_SECRET,
          { expiresIn }
        );

        // Set secure HTTP-only cookie
        const cookieMaxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 days or 7 days
        res.cookie('authToken', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: cookieMaxAge,
          signed: true
        });

        // Remove password from response
        delete user.password;

        res.json({
          success: true,
          message: 'Login realizado com sucesso',
          data: {
            user
          }
        });

      } catch (dbError) {
        // Development mode without database
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️  Login in development mode without database');
          
          // Accept any email/password in development
          const mockUserId = '507f1f77bcf86cd799439011';
          const expiresIn = remember ? '30d' : process.env.JWT_EXPIRES_IN;
          const token = jwt.sign(
            { userId: mockUserId },
            process.env.JWT_SECRET,
            { expiresIn }
          );

          // Set secure HTTP-only cookie
          const cookieMaxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000; // 30 days or 7 days
          res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: cookieMaxAge,
            signed: true
          });

          const userData = {
            _id: mockUserId,
            name: 'Development User',
            email: email.toLowerCase().trim(),
            role: 'user',
            active: true,
            lastLogin: new Date(),
            profile: { avatar: null, phone: null, company: null },
            settings: { notifications: true, darkMode: false, language: 'pt-BR' },
            stats: { totalSessions: 0, activeConnections: 0, messagesCount: 0 }
          };

          return res.json({
            success: true,
            message: 'Login realizado com sucesso (modo desenvolvimento)',
            data: { user: userData }
          });
        }
        throw dbError;
      }

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      res.json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { name, phone, company } = req.body;
      const users = database.getCollection('users');

      const updateData = {
        updatedAt: new Date()
      };

      if (name) updateData.name = name.trim();
      if (phone !== undefined) updateData['profile.phone'] = phone;
      if (company !== undefined) updateData['profile.company'] = company;

      await users.updateOne(
        { _id: new ObjectId(req.user._id) },
        { $set: updateData }
      );

      // Get updated user
      const updatedUser = await users.findOne(
        { _id: new ObjectId(req.user._id) },
        { projection: { password: 0 } }
      );

      res.json({
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: {
          user: updatedUser
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual e nova senha são obrigatórias'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'A nova senha deve ter pelo menos 6 caracteres'
        });
      }

      const users = database.getCollection('users');
      const user = await users.findOne({ _id: new ObjectId(req.user._id) });

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await users.updateOne(
        { _id: new ObjectId(req.user._id) },
        { $set: { password: hashedNewPassword, updatedAt: new Date() } }
      );

      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Logout user
  async logout(req, res) {
    try {
      // Clear the authentication cookie
      res.clearCookie('authToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        signed: true
      });

      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new AuthController();