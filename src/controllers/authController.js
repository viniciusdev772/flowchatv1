const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const database = require('../config/database');
const { clearUserCache } = require('../middleware/auth');

class AuthController {

  async register(req, res) {
    try {
      const { name, email, password } = req.body;


      const validationErrors = [];

      if (!name || name.trim().length < 2) {
        validationErrors.push({ path: 'name', msg: 'Nome deve ter pelo menos 2 caracteres' });
      }

      if (!email) {
        validationErrors.push({ path: 'email', msg: 'Email é obrigatório' });
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          validationErrors.push({ path: 'email', msg: 'Formato de email inválido' });
        }
      }

      if (!password) {
        validationErrors.push({ path: 'password', msg: 'Senha é obrigatória' });
      } else if (password.length < 8) {
        validationErrors.push({ path: 'password', msg: 'Senha deve ter pelo menos 8 caracteres' });
      } else {

        const hasLowercase = /[a-z]/.test(password);
        const hasUppercase = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[@$!%*?&]/.test(password);

        if (!hasLowercase || !hasUppercase || !hasNumber || !hasSpecial) {
          validationErrors.push({
            path: 'password',
            msg: 'Senha deve conter pelo menos: 1 minúscula, 1 maiúscula, 1 número e 1 caractere especial (@$!%*?&)'
          });
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos fornecidos',
          validationErrors: validationErrors
        });
      }


      try {
        const db = database.getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        const users = database.getCollection('users');


        const existingUser = await users.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Já existe um usuário cadastrado com este email',
            validationErrors: [{ path: 'email', msg: 'Este email já está sendo usado por outra conta' }]
          });
        }


        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);


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


        const token = jwt.sign(
          { userId: result.insertedId.toString() },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
        );


        res.cookie('authToken', token, {
          httpOnly: true,
          secure: 'auto',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          signed: true
        });


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

        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️  Registration in development mode without database');


          const mockUserId = '507f1f77bcf86cd799439011';
          const token = jwt.sign(
            { userId: mockUserId },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
          );


          res.cookie('authToken', token, {
            httpOnly: true,
            secure: 'auto',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
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


  async login(req, res) {
    try {
      const { email, password, remember } = req.body;


      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email e senha são obrigatórios'
        });
      }


      try {
        const db = database.getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        const users = database.getCollection('users');


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


        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: 'Credenciais inválidas'
          });
        }


        await users.updateOne(
          { _id: user._id },
          { $set: { lastLogin: new Date(), updatedAt: new Date() } }
        );


        const expiresIn = remember ? '30d' : process.env.JWT_EXPIRES_IN;
        const token = jwt.sign(
          { userId: user._id.toString() },
          process.env.JWT_SECRET,
          { expiresIn }
        );


        const cookieMaxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
        res.cookie('authToken', token, {
          httpOnly: true,
          secure: 'auto',
          sameSite: 'lax',
          maxAge: cookieMaxAge,
          signed: true
        });


        delete user.password;

        res.json({
          success: true,
          message: 'Login realizado com sucesso',
          data: {
            user
          }
        });

      } catch (dbError) {

        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️  Login in development mode without database');


          const mockUserId = '507f1f77bcf86cd799439011';
          const expiresIn = remember ? '30d' : process.env.JWT_EXPIRES_IN;
          const token = jwt.sign(
            { userId: mockUserId },
            process.env.JWT_SECRET,
            { expiresIn }
          );


          const cookieMaxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
          res.cookie('authToken', token, {
            httpOnly: true,
            secure: 'auto',
            sameSite: 'lax',
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


  getProfile(req, res) {


    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  }


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


      const updatedUser = await users.findOne(
        { _id: new ObjectId(req.user._id) },
        { projection: { password: 0 } }
      );


      clearUserCache(req.user._id);

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


      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Senha atual incorreta'
        });
      }


      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);


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


  async logout(req, res) {
    try {

      res.clearCookie('authToken', {
        httpOnly: true,
        secure: 'auto',
        sameSite: 'lax',
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