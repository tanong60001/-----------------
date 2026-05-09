// V58: client-side access guards for hidden-menu bypasses.
(function () {
  'use strict';

  const TAG = '[v58-access-guards]';
  const PAGE_PERMS = {
    home: null,
    pos: 'can_pos',
    inv: 'can_inv',
    cash: 'can_cash',
    exp: 'can_exp',
    debt: 'can_debt',
    att: 'can_att',
    purchase: 'can_purchase',
    dash: 'can_dash',
    history: 'can_log',
    log: 'can_log',
    customer: null,
    quotation: null,
    payable: null,
    admin: 'admin'
  };

  const ACTION_PERMS = {
    startCheckout: 'can_pos',
    completePayment: 'can_pos',
    v12CompletePayment: 'can_pos',
    v13CompletePayment: 'can_pos',
    v15CompletePayment: 'can_pos',
    v16CompletePayment: 'can_pos',
    v17CompletePayment: 'can_pos',
    v18CompletePayment: 'can_pos',
    addToCart: 'can_pos',
    updateCartQty: 'can_pos',
    removeFromCart: 'can_pos',

    renderInventory: 'can_inv',
    showAddProductModal: 'can_inv',
    editProduct: 'can_inv',
    saveProduct: 'can_inv',
    v9SaveProduct: 'can_inv',
    deleteProduct: 'can_inv',
    showImportProductsCsvModal: 'can_inv',
    v36MigrateProductImagesToStorage: 'admin',

    adjustStock: 'can_adjust_stock',
    v9AdjustStock: 'can_adjust_stock',

    renderCashDrawer: 'can_cash',
    openCashSession: 'can_cash',
    cashMovement: 'can_cash',
    recordCashTx: 'can_cash',
    closeCashSession: 'can_cash',
    v4OpenWithdrawWizard: 'can_cash',
    v26StartCashWizard: 'can_cash',

    renderExpenses: 'can_exp',
    loadExpenseData: 'can_exp',
    showAddExpenseModal: 'can_exp',
    deleteExpense: 'can_exp',
    v28ExpenseWiz: 'can_exp',

    renderDebts: 'can_debt',
    recordDebtPayment: 'can_debt',

    renderPurchases: 'can_purchase',
    showAddPurchaseModal: 'can_purchase',
    receivePurchase: 'can_purchase',

    renderAttendance: 'can_att',
    checkIn: 'can_att',
    checkOut: 'can_att',
    showAddEmployeeModal: 'can_att',
    renderPayroll: 'can_att',
    renderPayrollV26: 'can_att',
    v26SaveAll: 'can_att',
    v26DoPay: 'can_att',
    openAdvanceWizard: 'can_att',
    v56OpenEmployeeCalendar: 'can_att',

    renderDashboard: 'can_dash',
    renderDashboardV3: 'can_dash',
    v57OpenProfitCalendar: 'can_dash',
    renderStaffSalesDashboard: 'can_dash',

    renderHistory: 'can_log',
    renderActivityLog: 'can_log',
    v24ShowDocSelector: 'can_log',
    v24PrintDocument: 'can_log',
    v5PrintFromHistory: 'can_log',

    renderAdmin: 'admin',
    renderAdminTabs: 'admin',
    v36AdminOpenSection: 'admin',
    showAddUserModal: 'admin',
    deleteUser: 'admin',
    deleteCat: 'admin',
    editCat: 'admin',
    skEditUserPin: 'admin',
    v49RenderCommissionAdmin: 'admin',
    v49SaveCommissionSettings: 'admin',
    v49ResetDefaultCommission: 'admin',
    v48OpenCommissionSettings: 'admin'
  };

  let session = null;

  function clonePerms(perms) {
    return Object.freeze({ ...(perms || {}) });
  }

  function currentUser() {
    try { return typeof USER !== 'undefined' ? USER : window.USER; }
    catch (_) { return window.USER; }
  }

  function currentPerms() {
    try { return typeof USER_PERMS !== 'undefined' ? USER_PERMS : window.USER_PERMS; }
    catch (_) { return window.USER_PERMS; }
  }

  function captureSession() {
    const user = currentUser();
    if (!user) {
      session = null;
      return;
    }

    const sameUser = session && session.id === user.id;
    if (sameUser) return;

    session = Object.freeze({
      id: user.id,
      username: user.username,
      role: user.role,
      perms: clonePerms(currentPerms())
    });
  }

  function sessionIsValid() {
    const user = currentUser();
    return !!(session && user && user.id === session.id);
  }

  function isAdmin() {
    captureSession();
    return sessionIsValid() && session.role === 'admin';
  }

  function can(permission) {
    captureSession();
    if (!sessionIsValid()) return false;
    if (session.role === 'admin') return true;
    if (!permission) return true;
    if (permission === 'admin') return false;
    if (permission === 'can_adjust_stock') {
      return session.perms.can_adjust_stock === true ||
        session.perms.can_manage === true;
    }
    if (permission === 'can_promotion') {
      return session.perms.can_promotion === true ||
        session.perms.can_manage === true;
    }
    return session.perms[permission] === true || session.perms.can_manage === true;
  }

  function canPage(page) {
    if (page === 'admin') return isAdmin();
    return can(PAGE_PERMS[page]);
  }

  function deny(label) {
    const msg = label ? `ไม่มีสิทธิ์ใช้งาน: ${label}` : 'ไม่มีสิทธิ์ใช้งานส่วนนี้';
    if (window.Swal?.fire) {
      window.Swal.fire({
        icon: 'warning',
        title: 'ไม่มีสิทธิ์',
        text: msg,
        confirmButtonColor: '#dc2626'
      });
    } else if (typeof window.toast === 'function') {
      window.toast(msg, 'error');
    } else {
      console.warn(TAG, msg);
    }
    return false;
  }

  function setGlobal(name, fn) {
    window[name] = fn;
    try { Function('name', 'fn', 'window[name] = fn; eval(name + " = fn");')(name, fn); }
    catch (_) {}
  }

  function wrapFunction(name, permission) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v58Guarded) return;

    const guarded = function () {
      if (!can(permission)) return deny(name);
      return original.apply(this, arguments);
    };

    Object.defineProperty(guarded, '__v58Guarded', { value: true });
    Object.defineProperty(guarded, '__v58Original', { value: original });
    setGlobal(name, guarded);
  }

  function installHasPermissionGuard() {
    const guardedHasPermission = function (page) {
      return canPage(page);
    };
    Object.defineProperty(guardedHasPermission, '__v58Guarded', { value: true });
    setGlobal('hasPermission', guardedHasPermission);

    if (typeof window.applyNavPermissions === 'function' && !window.applyNavPermissions.__v58Guarded) {
      const originalApply = window.applyNavPermissions;
      const guardedApply = function () {
        captureSession();
        const result = originalApply.apply(this, arguments);
        const admin = isAdmin();
        document.getElementById('nav-admin-section')?.style.setProperty('display', admin ? 'block' : 'none');
        document.getElementById('nav-admin')?.style.setProperty('display', admin ? 'flex' : 'none');
        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
          const page = item.dataset.page;
          item.style.display = canPage(page) ? '' : 'none';
        });
        return result;
      };
      Object.defineProperty(guardedApply, '__v58Guarded', { value: true });
      setGlobal('applyNavPermissions', guardedApply);
    }
  }

  function installNavigationGuard() {
    if (typeof window.go !== 'function' || window.go.__v58Guarded) return;
    const originalGo = window.go;
    const guardedGo = function (page) {
      captureSession();
      if (!canPage(page)) {
        deny(page);
        page = 'home';
      }
      return originalGo.call(this, page);
    };
    Object.defineProperty(guardedGo, '__v58Guarded', { value: true });
    setGlobal('go', guardedGo);
  }

  function installLoginSnapshot() {
    if (typeof window.checkLogin === 'function' && !window.checkLogin.__v58Guarded) {
      const originalLogin = window.checkLogin;
      const guardedLogin = async function () {
        const beforeId = currentUser()?.id;
        const result = await originalLogin.apply(this, arguments);
        const afterUser = currentUser();
        if (afterUser && afterUser.id !== beforeId) {
          session = null;
          captureSession();
          window.applyNavPermissions?.();
        }
        return result;
      };
      Object.defineProperty(guardedLogin, '__v58Guarded', { value: true });
      setGlobal('checkLogin', guardedLogin);
    }

    if (typeof window.logout === 'function' && !window.logout.__v58Guarded) {
      const originalLogout = window.logout;
      const guardedLogout = function () {
        session = null;
        return originalLogout.apply(this, arguments);
      };
      Object.defineProperty(guardedLogout, '__v58Guarded', { value: true });
      setGlobal('logout', guardedLogout);
    }
  }

  function installKnownGuards() {
    Object.entries(ACTION_PERMS).forEach(([name, permission]) => wrapFunction(name, permission));
  }

  function inferredPermissionForName(name) {
    if (/^(v9RenderAdminTab|v9Admin|v9Manage|v10Save|v10SetHeader|v10RenderAdmin)/.test(name)) return 'admin';
    if (/^(v9SavePermission|savePermission|v9EditUserPin|v48OpenCommission|v49)/.test(name)) return 'admin';
    if (/^(v9Pur|submitPurchaseOrder|savePurchaseOrder|openReceiveModal)/.test(name)) return 'can_purchase';
    if (/^(v9ConfirmAdvance|v9ShowPayroll|v9UpdatePay|v9ConfirmPayroll|v9DeleteEmployee|v9SaveEmployee|v26DoPay|p31)/.test(name)) return 'can_att';
    if (/^(v9Recipe|v9Produce|v9AdminRecipe|v9AdminUnits|v9Units|v9Unit|v9SaveProduct|v9HandleImage|v9ClearProductImage)/.test(name)) return 'can_inv';
    if (/^(v12CompletePayment|v12NextStep|v13CompletePayment|v15CompletePayment|v16CompletePayment|v17CompletePayment|v18CompletePayment)/.test(name)) return 'can_pos';
    return null;
  }

  function installPatternGuards() {
    Object.keys(window).forEach(name => {
      const permission = inferredPermissionForName(name);
      if (permission) wrapFunction(name, permission);
    });
  }

  function installStockCompatibilityOverrides() {
    window.v52CanAdjustStock = () => can('can_adjust_stock');
    window.v9CanAdjustStock = window.v52CanAdjustStock;
    window.v9CanPromotion = () => can('can_promotion');
  }

  function installGuards() {
    captureSession();
    installHasPermissionGuard();
    installNavigationGuard();
    installLoginSnapshot();
    installKnownGuards();
    installPatternGuards();
    installStockCompatibilityOverrides();
    window.__SK_ACCESS_GUARD__ = Object.freeze({
      version: 58,
      can,
      canPage,
      isAdmin,
      currentSession: () => session
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installGuards);
  } else {
    installGuards();
  }

  setTimeout(installGuards, 300);
  setTimeout(installGuards, 1200);
  console.log(TAG, 'loaded');
})();
