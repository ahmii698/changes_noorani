// src/components/Users.jsx

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiUsers, FiPlus, FiX, FiEdit2, FiTrash2, FiCheckCircle, FiLoader, FiUser, FiMail, FiShield } from 'react-icons/fi';
import api from '../services/api';

const Users = ({ darkMode }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/users');
      
      let userData = [];
      if (response.data?.data && Array.isArray(response.data.data)) {
        userData = response.data.data;
      } else if (Array.isArray(response.data)) {
        userData = response.data;
      } else if (response.data?.success && Array.isArray(response.data.data)) {
        userData = response.data.data;
      } else {
        userData = [];
      }
      
      setUsers(userData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (editingUser) {
        const payload = {
          name: formData.name,
          email: formData.email,
          role: formData.role
        };
        if (formData.password) {
          payload.password = formData.password;
        }
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success('User updated successfully!');
      } else {
        await api.post('/users', {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
        toast.success('User created successfully!');
      }
      
      setShowModal(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'employee' });
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.response?.data?.message || 'Failed to save user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to delete "${user.name}"?`)) return;
    
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('User deleted successfully!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', role: 'employee' });
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role || 'employee'
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <FiLoader className="text-5xl text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - Amber Theme */}
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200 shadow-sm'} p-5`}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
              <FiUsers className="text-2xl text-amber-400" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Users</h1>
              <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                Manage system users and employees
              </p>
            </div>
          </div>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-amber-400 text-gray-900 rounded-lg text-sm font-bold hover:bg-amber-300 transition flex items-center gap-2 shadow-md"
          >
            <FiPlus className="text-base" /> Add User
          </button>
        </div>
      </div>

      {/* Table - Amber Theme with Bold Text */}
      <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200 shadow-sm'} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
              <tr>
                <th className={`px-5 py-3 text-left text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>#</th>
                <th className={`px-5 py-3 text-left text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Name</th>
                <th className={`px-5 py-3 text-left text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Email</th>
                <th className={`px-5 py-3 text-left text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Role</th>
                <th className={`px-5 py-3 text-left text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Created At</th>
                <th className={`px-5 py-3 text-center text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center">
                    <FiUsers className="text-4xl mx-auto mb-3 text-gray-400" />
                    <p className={`text-base font-bold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>No users found</p>
                  </td>
                </tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id || index} className={`${darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}>
                    <td className={`px-5 py-3.5 text-sm font-bold ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>{index + 1}</td>
                    <td className="px-5 py-3.5">
                      <span className={`font-bold text-base ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        <FiUser className="inline mr-2 text-amber-400 text-sm" />
                        {user.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>
                        <FiMail className="inline mr-2 text-gray-400 text-sm" />
                        {user.email}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1.5 w-fit ${
                        user.role === 'admin' 
                          ? 'bg-amber-500/20 text-amber-500' 
                          : 'bg-blue-500/20 text-blue-500'
                      }`}>
                        <FiShield className="text-sm" />
                        {user.role === 'admin' ? 'Admin' : 'Employee'}
                      </span>
                    </td>
                    <td className={`px-5 py-3.5 text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-500'}`}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-2 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition font-bold"
                          title="Edit User"
                        >
                          <FiEdit2 className="text-base" />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition font-bold"
                          title="Delete User"
                        >
                          <FiTrash2 className="text-base" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer */}
        <div className={`px-5 py-3 border-t ${darkMode ? 'border-gray-800 bg-gray-800/50' : 'border-gray-200 bg-gray-50'} flex justify-between items-center flex-wrap gap-2`}>
          <div className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-gray-600'}`}>
            Total Users: <strong className={darkMode ? 'text-white' : 'text-gray-900'}>{users.length}</strong>
          </div>
          <button
            onClick={fetchUsers}
            className={`text-sm font-bold px-4 py-1.5 rounded-lg transition ${
              darkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Add/Edit User Modal - Amber Theme */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`max-w-md w-full rounded-xl shadow-2xl ${darkMode ? 'bg-gray-900' : 'bg-white'} border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
            <div className={`flex justify-between items-center p-5 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
              <h2 className={`text-xl font-bold flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                <FiUsers className="text-amber-400 text-2xl" />
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <FiX className="text-xl" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className={`block text-sm font-bold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter full name"
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-bold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email Address *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder="Enter email address"
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-bold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Password {editingUser && <span className="text-sm text-gray-400">(Leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  placeholder={editingUser ? 'Enter new password (optional)' : 'Enter password'}
                  required={!editingUser}
                  minLength="6"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-bold mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-lg border text-base font-medium focus:ring-2 focus:ring-amber-400 outline-none transition ${
                    darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg transition text-base font-bold ${
                    darkMode ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-amber-400 text-gray-900 rounded-lg text-base font-bold hover:bg-amber-300 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <FiLoader className="animate-spin text-lg" /> : <FiCheckCircle className="text-lg" />}
                  {isSubmitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;