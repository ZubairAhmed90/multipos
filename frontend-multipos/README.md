1# 🏪 MultiPOS Frontend

A comprehensive React-based frontend application for multi-location point-of-sale operations.

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd frontend-multipos
npm install

# Setup environment
cp .env.template .env.local
# Edit .env.local with your configuration

# Start development
npm run dev
```

## 📋 Features

- **🔐 Authentication**: JWT-based auth with role-based access control
- **🏢 Multi-location**: Branch and warehouse management
- **📦 Inventory**: Product catalog and stock tracking
- **💰 Sales & POS**: Point-of-sale operations
- **👥 User Management**: Admin user management
- **📊 Analytics**: Real-time dashboard and reporting
- **⚡ Performance**: Intelligent caching and optimization
- **🛡️ Error Handling**: Comprehensive error management

## 🏗️ Tech Stack

- **Next.js 14** with App Router
- **Material-UI** for components
- **Redux Toolkit** for state management
- **Axios** for API calls
- **React Hook Form** for forms
- **Jest** for testing

## 📚 Documentation

- [Frontend Architecture](docs/frontend-architecture-overview.md)
- [Redux State Management](docs/redux-state-management.md)
- [API Integration](docs/api-integration.md)
- [Authentication & RBAC](docs/authentication-rbac.md)
- [Component Library](docs/component-library.md)
- [Developer Guide](docs/developer-guide.md)

## 🧪 Testing

Test pages available at:
- `/test-auth` - Authentication testing
- `/test-rbac` - Role-based access control
- `/test-api` - API integration
- `/test-polling` - Real-time updates
- `/test-error-handling` - Error handling
- `/test-performance` - Performance optimization
- `/test-admin-settings` - Admin settings

## 🛠️ Development

```bash
npm run dev          # Development server
npm run build        # Production build
npm run test         # Run tests
npm run lint         # Code linting
npm run format       # Code formatting
```

## 🚀 Deployment

```bash
npm run build
npm run start
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

---

**Version**: 1.0.0 | **Status**: Production Ready ✅