const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const database = require('../config/database');

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email and password are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
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
            message: 'User already exists with this email'
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

        // Remove password from response
        delete userData.password;
        userData._id = result.insertedId;

        res.status(201).json({
          success: true,
          message: 'User registered successfully',
          data: {
            user: userData,
            token
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
            message: 'User registered successfully (development mode)',
            data: { user: userData, token }
          });
        }
        throw dbError;
      }

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
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
          message: 'Email and password are required'
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
            message: 'Invalid credentials'
          });
        }

        if (!user.active) {
          return res.status(401).json({
            success: false,
            message: 'Account is deactivated'
          });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
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

        // Remove password from response
        delete user.password;

        res.json({
          success: true,
          message: 'Login successful',
          data: {
            user,
            token
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
            message: 'Login successful (development mode)',
            data: { user: userData, token }
          });
        }
        throw dbError;
      }

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
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
        message: 'Internal server error'
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
        message: 'Profile updated successfully',
        data: {
          user: updatedUser
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
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
          message: 'Current password and new password are required'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long'
        });
      }

      const users = database.getCollection('users');
      const user = await users.findOne({ _id: new ObjectId(req.user._id) });

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
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
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = new AuthController();