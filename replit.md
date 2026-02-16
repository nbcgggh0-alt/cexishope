# CexiStore Ultimate Pro - Project Documentation

## Overview
CexiStore Ultimate Pro is a comprehensive bilingual (Malay/English) Telegram e-commerce bot designed for digital product sales. It offers over 110 functions for users, administrators, and owners, facilitating product browsing, ordering, QR-based payments, live chat support, and manual digital product delivery. The project aims to provide a robust and user-friendly platform for e-commerce within the Telegram ecosystem, with a focus on ease of use and efficient management of digital goods.

## Recent Changes (November 2025)
- **Order Queue Management System (NEW - Nov 20)**: Intelligent queue system that automatically manages customer orders when all admins are busy. Features include automatic queue positioning, estimated wait time calculation, priority orders, admin processing tracking, and automatic customer notifications when their turn arrives. System tracks average processing time and adapts estimates accordingly. Accessible via Admin Panel → Antrian Order.
- **Removed Non-Functional Features (Nov 20)**: Removed "My Items" button from main menu as it was non-functional due to manual delivery system. All completed orders can be viewed in "My Orders" section instead.
- **Telegram-Only Architecture (Nov 20)**: Removed all web components (admin panel, web server, public folder). All features now accessible exclusively via Telegram bot for streamlined management.
- **Product Options/Variants System (NEW - Nov 1)**: Comprehensive product options system allowing admins to add variants like size, color, subscription duration to products. Features include required/optional options, price modifiers per option, and bilingual support. Accessible via Product Detail → Product Options.
- **Scheduled Product Publishing (NEW - Nov 1)**: Auto-publish products at scheduled date/time. Set future publish dates for products, and they will automatically activate when the scheduled time arrives. Includes auto-notification to owner. Accessible via Product Detail → Schedule Publish or Product Management → Scheduled Products.
- **Category-Based Discounts (NEW - Nov 1)**: Apply percentage or fixed amount discounts to entire categories. All products in a category automatically receive the category discount. Supports both percentage (e.g., 10% off) and fixed amount (e.g., RM5 off) discounts. Accessible via Category Management → Category Discounts.
- **Review & Rating System (NEW - Nov 1)**: Complete product review and rating system (1-5 stars). Customers can rate and review products after verified purchases. Displays average ratings, rating distribution, and recent reviews. Accessible via Product Detail → View Reviews.
- **Advanced Order Filtering by Date (NEW - Nov 1)**: Filter orders by date ranges including Today, Yesterday, This Week, This Month, Last 7 Days, Last 30 Days, or Custom Range. Shows detailed statistics including total revenue, order counts by status, and order lists. Accessible via Admin Panel → Advanced Order Filters.
- **Quick Edit for Products (NEW - Nov 1)**: Streamlined product editing without full edit flow. Quickly update price, stock, name, description, or toggle status using simple inline format (e.g., PROD-XXX | 25.50). Accessible via Product Management → Quick Edit.
- **Product Image Management (NEW - Nov 1)**: Upload, view, and delete product images. Supports multiple images per product with automatic file management. Images stored in media/products/ folder. Accessible via Product Detail → Product Images.
- **Admin Activity Logging (Oct 16)**: Implemented comprehensive admin activity logging system that tracks all critical admin operations including order verification/rejection, admin management (add/remove), user ban/unban actions, and log clearing. System shows accurate total count and displays recent activities with admin names, timestamps, and action details. Logs stored in `admin_logs.json` with automatic rotation.
- **Data Export Feature**: Implemented fully functional data export system with 4 export options - users, products, transactions, and complete export (all data). Exports are delivered as JSON files with proper bilingual support.
- **Store Status Control**: Added store open/close functionality separate from maintenance mode. When store is closed, customers cannot place orders but can still browse products and access other features. Accessible via System Panel → Store Status.
- **Dropbox Manual Token Support**: Simplified token management via `/addapi` command for external hosting. No environment variables needed - just use /addapi command to set token directly
- **Auto Promote System (10 Functions)**: Added comprehensive promotional campaign management including broadcast, scheduling, templates, targeting, analytics, A/B testing, discount codes, flash sales, and repeat campaigns
- **System Functions (20 Functions)**: Implemented advanced system management including user stats, sales analytics, admin logs, health checks, performance monitoring, storage usage, data export/import, maintenance mode, and cache management

## User Preferences
- **Hosting**: Designed for external hosting (Render, Pterodactyl Panel, etc.)
- **Dropbox Authentication**: Manual token via `/addapi` command - simple setup tanpa environment variables
- **Telegram-Only**: All features accessible via Telegram bot - no web interface
- Backup interval: 5 minutes (configurable in `config.js`)
- JSON file-based storage (no external database)
- Bilingual support (Malay primary, English secondary)
- QR-based payment (no gateway integration)
- Manual payment verification workflow

## System Architecture

### UI/UX Decisions
- **Bilingual Interface**: Supports Malay and English with a toggle option.
- **Interactive Buttons**: Extensive use of inline and reply keyboard buttons for intuitive navigation and quick actions.
- **Clear Notifications**: Users receive timely updates on order status, payment verification, and support session progress.
- **Media Support**: QR codes are sent as images, and live chat supports photo exchange for better communication.
- **Pre-loaded content**: Includes pre-loaded FAQs and message templates to enhance user experience and streamline support.

### Technical Implementations
- **Bot Framework**: Built on Node.js using the Telegraf framework.
- **JSON-based Database**: All project data (users, products, transactions, sessions, etc.) is stored in local JSON files within the `data/` directory.
- **Modular Handlers**: Functionality is organized into distinct handlers (e.g., `start.js`, `products.js`, `admin.js`, `session.js`) for maintainability.
- **Utility Functions**: Common tasks like database operations, translations, and message handling are encapsulated in `utils/` for reusability.
- **Safe Message Editing**: Implemented a `safeEditMessage` helper to gracefully handle editing both text and media messages, preventing "Bad Request" errors.
- **Session Management**: Token-based live chat sessions with a 4-hour auto-timeout feature. Admins can join, leave, and close sessions.
- **Multi-session Handling**: Admins can only be in one active support session at a time, with automatic context switching to prevent message routing issues.
- **Order Queue Management**: Intelligent queue system (`utils/queueManager.js`) that automatically manages customer orders when all admins are busy. Tracks queue position, estimated completion times, processing status, and notifies customers when their turn arrives. Supports priority orders, concurrent processing limits, and adaptive time estimation based on historical processing times. Queue data stored in `data/queue.json` with settings in `data/queue_settings.json`.
- **Auto-Backup System**: Automated backups every 5 minutes that create ZIP archives of all data files (excluding backup folder to prevent loops) and upload to Dropbox. The system also automatically checks for and restores new data from Dropbox API. Manual backup available via `/backupnow` command with bilingual support and comprehensive error handling.
- **Admin Activity Logging**: Complete audit trail system (`utils/adminLogger.js`) that tracks all critical admin operations with timestamps, admin IDs, actions, and details. Integrated into order verification/rejection, admin management, user ban/unban operations, and system maintenance tasks.

### Feature Specifications
- **User System**: Product browsing, ordering, QR payment proof upload, order history, live chat, language toggle, queue status checking (`/queue` or `/myqueue`).
- **Admin System**: Order verification/rejection, product/category management, manual product delivery, support session management, customer communication, notifications, stock management, queue management (view waiting/processing orders, set priorities, adjust settings with `/setqueuemax` and `/setqueuetime`).
- **Owner System**: Admin management (add/remove), owner setup, store settings configuration, welcome media customization, payment QR management, automated backup to Dropbox (every 5 minutes + manual `/backupnow` command).
- **Auto Promote System (10 Functions)**: Broadcast messaging, scheduled promotions, promotion templates, user targeting, analytics dashboard, A/B testing, discount code management, flash sales, repeat campaigns, active campaign monitoring.
- **System Functions (20 Functions)**: User statistics, sales analytics, admin activity logs, system health monitoring, backup/restore UI, error tracking, performance metrics, storage usage monitoring, API rate limits, webhook logs, transaction reports, inventory alerts, session analytics, user engagement metrics, revenue dashboard, data export/import, system settings management, maintenance mode, cache control.
- **Auto Systems**: Unique ID generation, session timeout, stock-based product visibility, admin notifications, OAuth token refresh.
- **Payment Flow**: User places order -> Bot sends QR -> User pays & uploads proof via `/send` -> Admin verifies (`/verify` or `/reject`) -> Admin manually delivers item to customer.
- **Product Types**: All products are "Manual" delivery (admin handles delivery after verification).

### System Design Choices
- **Event-Driven**: The bot primarily responds to Telegram messages and commands.
- **Local Persistence**: All data is stored locally in JSON files, avoiding external database dependencies.
- **Config-driven**: Core settings and tokens are managed through `config.js` for easy modification.
- **Structured File System**: Well-organized directory structure to separate concerns (handlers, utils, data, media).

## External Dependencies
- **Telegram Bot API**: Core communication platform for the bot.
- **Node.js**: Runtime environment.
- **Telegraf**: Bot framework for interacting with the Telegram Bot API.
- **Dropbox API with OAuth**: Primary backup storage with automated data synchronization every 5 minutes using Replit connector for automatic token refresh.
- **Google Drive API**: Secondary backup storage with automatic failover when primary storage is full.
- **Archiver**: ZIP compression for backup files.
- **Node-cron**: Scheduled task execution utilities.
- **PDFKit**: For PDF receipt generation.
- **Sharp**: For image processing.
- **UUID**: For generating unique identifiers.
- **Dropbox NPM Package (10.34.0)**: Official Dropbox SDK for OAuth integration.