(() => {
  "use strict";

  const data = window.ADMIN_MOCK_DATA;
  if (!data) {
    return;
  }

  const CLAIM_WINDOW_DAYS = 7;
  const DEMO_NOW = new Date(data.demoNowIso || new Date().toISOString());

  const TASK_TYPE_LABELS = {
    add_to_cart: "Добавить товары в корзину",
    add_to_favorites: "Добавить товары в избранное",
    purchase_amount: "Покупка на сумму",
    purchase_category: "Покупка в категории",
    purchase_seller: "Покупка у продавца",
    visit_url: "Посетить URL",
    visit_app_screen: "Посетить экран приложения",
    visit_external_url: "Посетить сторонний URL",
  };

  const STATUS_LABELS = {
    upcoming: "upcoming",
    active: "active",
    completed: "completed",
    reward_claimed: "reward_claimed",
    expired: "expired",
  };

  const REWARD_LABELS = {
    bonus: "bonus",
    promocode: "promocode",
    activity_points: "activity_points",
  };

  const TARGET_LABELS = {
    internal_url: "internal_url",
    external_url: "external_url",
    app_screen: "app_screen",
  };

  const PURCHASE_TYPES = ["purchase_amount", "purchase_category", "purchase_seller"];

  const state = {
    tasks: clone(data.tasks),
    taskUserStates: clone(data.taskUserStates),
    users: clone(data.users),
    screen: "tasks",
    globalSearch: "",
    quickFilter: "all",
    editingTaskId: null,
    selectedTaskIds: new Set(),
    selectedUserId: null,
    tasksFilters: {
      status: "all",
      type: "all",
      reward: "all",
      dateFrom: "",
      dateTo: "",
      hasPoints: "all",
    },
    completion: {
      taskId: "",
      status: "all",
      dateFrom: "",
      dateTo: "",
      unclaimedOnly: false,
    },
    usersFilters: {
      minPoints: "",
      maxPoints: "",
      expiringDays: "",
      phone: "",
    },
  };

  const els = {
    navLinks: Array.from(document.querySelectorAll(".nav-link")),
    screens: {
      tasks: document.getElementById("screen-tasks"),
      editor: document.getElementById("screen-editor"),
      completions: document.getElementById("screen-completions"),
      users: document.getElementById("screen-users"),
    },
    globalSearch: document.getElementById("globalSearch"),
    quickFilters: Array.from(document.querySelectorAll("[data-quick-filter]")),
    quickFiltersWrap: document.getElementById("quickFilters"),
    createTaskQuick: document.getElementById("createTaskQuick"),

    tasksStatusFilter: document.getElementById("tasksStatusFilter"),
    tasksTypeFilter: document.getElementById("tasksTypeFilter"),
    tasksRewardFilter: document.getElementById("tasksRewardFilter"),
    tasksDateFromFilter: document.getElementById("tasksDateFromFilter"),
    tasksDateToFilter: document.getElementById("tasksDateToFilter"),
    tasksHasPointsFilter: document.getElementById("tasksHasPointsFilter"),
    tasksResetFilters: document.getElementById("tasksResetFilters"),
    selectAllTasks: document.getElementById("selectAllTasks"),
    selectedTasksCount: document.getElementById("selectedTasksCount"),
    bulkPriority: document.getElementById("bulkPriority"),
    bulkApplyPriority: document.getElementById("bulkApplyPriority"),
    bulkArchive: document.getElementById("bulkArchive"),
    tasksExportCsv: document.getElementById("tasksExportCsv"),
    tasksTableBody: document.getElementById("tasksTableBody"),

    editorTitle: document.getElementById("editorTitle"),
    taskForm: document.getElementById("taskForm"),
    formErrorsPanel: document.getElementById("formErrorsPanel"),
    formErrors: document.getElementById("formErrors"),
    taskCode: document.getElementById("taskCode"),
    taskCodeHint: document.getElementById("taskCodeHint"),
    taskTitle: document.getElementById("taskTitle"),
    taskDescription: document.getElementById("taskDescription"),
    imageFile: document.getElementById("imageFile"),
    imageUrl: document.getElementById("imageUrl"),
    imagePreview: document.getElementById("imagePreview"),
    priority: document.getElementById("priority"),
    activeFrom: document.getElementById("activeFrom"),
    activeTo: document.getElementById("activeTo"),
    taskType: document.getElementById("taskType"),
    conditionFields: document.getElementById("conditionFields"),
    purchasePeriodSection: document.getElementById("purchasePeriodSection"),
    purchaseFrom: document.getElementById("purchaseFrom"),
    purchaseTo: document.getElementById("purchaseTo"),
    targetType: document.getElementById("targetType"),
    targetValue: document.getElementById("targetValue"),
    rewardBonus: document.getElementById("rewardBonus"),
    rewardPromocode: document.getElementById("rewardPromocode"),
    rewardPoints: document.getElementById("rewardPoints"),
    bonusSection: document.getElementById("bonusSection"),
    bonusAmount: document.getElementById("bonusAmount"),
    promoSection: document.getElementById("promoSection"),
    promocodeCode: document.getElementById("promocodeCode"),
    promocodeValidTo: document.getElementById("promocodeValidTo"),
    promocodeTerms: document.getElementById("promocodeTerms"),
    pointsSection: document.getElementById("pointsSection"),
    pointsAmount: document.getElementById("pointsAmount"),
    pointsExpireAt: document.getElementById("pointsExpireAt"),
    publicationState: document.getElementById("publicationState"),
    simulatedStatus: document.getElementById("simulatedStatus"),
    forceStatusWrap: document.getElementById("forceStatusWrap"),
    forcedStatus: document.getElementById("forcedStatus"),
    forceWarning: document.getElementById("forceWarning"),
    statusModeRadios: Array.from(document.querySelectorAll("input[name='status_mode']")),
    saveDraftBtn: document.getElementById("saveDraftBtn"),
    publishTaskBtn: document.getElementById("publishTaskBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    presetVisitPromoPoints: document.getElementById("presetVisitPromoPoints"),
    presetPurchaseTask: document.getElementById("presetPurchaseTask"),

    completionTaskSelect: document.getElementById("completionTaskSelect"),
    completionStatusFilter: document.getElementById("completionStatusFilter"),
    completionDateFrom: document.getElementById("completionDateFrom"),
    completionDateTo: document.getElementById("completionDateTo"),
    completionUnclaimedOnly: document.getElementById("completionUnclaimedOnly"),
    completionResetFilters: document.getElementById("completionResetFilters"),
    completionExportCsv: document.getElementById("completionExportCsv"),
    completionTableBody: document.getElementById("completionTableBody"),
    completionSummaryCompleted: document.getElementById("completionSummaryCompleted"),
    completionSummaryClaimWindow: document.getElementById("completionSummaryClaimWindow"),
    completionSummaryExpired: document.getElementById("completionSummaryExpired"),

    usersMinPoints: document.getElementById("usersMinPoints"),
    usersMaxPoints: document.getElementById("usersMaxPoints"),
    usersExpiringDays: document.getElementById("usersExpiringDays"),
    usersPhoneFilter: document.getElementById("usersPhoneFilter"),
    usersResetFilters: document.getElementById("usersResetFilters"),
    usersTableBody: document.getElementById("usersTableBody"),
    userDetailPanel: document.getElementById("userDetailPanel"),

    toast: document.getElementById("toast"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalCancel: document.getElementById("modalCancel"),
    modalConfirm: document.getElementById("modalConfirm"),
  };

  const modalState = {
    resolver: null,
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toIsoDateInput(value) {
    if (!value) {
      return "";
    }
    return String(value).slice(0, 10);
  }

  function toIsoDateTimeInput(value) {
    if (!value) {
      return "";
    }
    return String(value).slice(0, 16);
  }

  function toLocalDateTimeInput(date) {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  }

  function formatDate(value) {
    const date = parseDate(value);
    if (!date) {
      return "—";
    }
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) {
      return "—";
    }
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isValidUrl(value) {
    try {
      const url = new URL(value);
      return Boolean(url.protocol && url.host);
    } catch {
      return false;
    }
  }

  function daysLeft(targetIso) {
    const target = parseDate(targetIso);
    if (!target) {
      return null;
    }
    const ms = target.getTime() - DEMO_NOW.getTime();
    return Math.ceil(ms / 86400000);
  }

  function isWithinDateRange(dateIso, fromIso, toIso) {
    const date = parseDate(dateIso);
    if (!date) {
      return false;
    }
    if (fromIso) {
      const from = parseDate(fromIso);
      if (from && date < from) {
        return false;
      }
    }
    if (toIso) {
      const to = parseDate(`${toIso}T23:59:59`);
      if (to && date > to) {
        return false;
      }
    }
    return true;
  }

  function getSelectedStatusMode() {
    const radio = els.statusModeRadios.find((item) => item.checked);
    return radio ? radio.value : "auto";
  }

  function getTaskById(taskId) {
    return state.tasks.find((task) => task.id === taskId);
  }

  function getTaskStates(taskId) {
    return state.taskUserStates.filter((stateItem) => stateItem.task_id === taskId);
  }

  function getEffectiveUserStatus(stateItem) {
    if (stateItem.status !== "completed") {
      return stateItem.status;
    }
    if (!stateItem.claim_window_until) {
      return "completed";
    }
    const windowEnd = parseDate(stateItem.claim_window_until);
    if (!windowEnd) {
      return "completed";
    }
    return DEMO_NOW > windowEnd ? "expired" : "completed";
  }

  function computeTaskStatus(task) {
    if (task.status_mode === "force" && task.forced_status) {
      return task.forced_status;
    }

    if (task.simulated_status) {
      return task.simulated_status;
    }

    const activeFrom = parseDate(task.active_from);
    const activeTo = parseDate(task.active_to);

    if (activeFrom && DEMO_NOW < activeFrom) {
      return "upcoming";
    }

    if (activeTo && DEMO_NOW <= activeTo) {
      return "active";
    }

    const states = getTaskStates(task.id);
    const hasCompletedInWindow = states.some((stateItem) => {
      const status = getEffectiveUserStatus(stateItem);
      return status === "completed";
    });

    if (hasCompletedInWindow) {
      return "completed";
    }

    const hasClaimed = states.some((stateItem) => stateItem.status === "reward_claimed");
    if (hasClaimed) {
      return "reward_claimed";
    }

    return "expired";
  }

  function hasClaimWindowTask(task) {
    const taskEnd = parseDate(task.active_to);
    if (!taskEnd || DEMO_NOW <= taskEnd) {
      return false;
    }
    return getTaskStates(task.id).some((stateItem) => getEffectiveUserStatus(stateItem) === "completed");
  }

  function statusBadge(status) {
    const label = STATUS_LABELS[status] || status;
    return `<span class="badge status-${escapeHtml(status)}">${escapeHtml(label)}</span>`;
  }

  function publicationBadge(publication) {
    return `<span class="badge publication-${escapeHtml(publication)}">${escapeHtml(publication)}</span>`;
  }

  function rewardBadges(rewardTypes) {
    if (!rewardTypes || rewardTypes.length === 0) {
      return "—";
    }
    return rewardTypes
      .map((reward) => `<span class="badge reward">${escapeHtml(REWARD_LABELS[reward] || reward)}</span>`)
      .join(" ");
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      els.toast.classList.add("hidden");
    }, 2800);
  }

  function openModal(options) {
    const {
      title,
      bodyHtml,
      confirmText = "Подтвердить",
      cancelText = "Отмена",
      showCancel = true,
      danger = false,
    } = options;

    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = bodyHtml;
    els.modalConfirm.textContent = confirmText;
    els.modalCancel.textContent = cancelText;
    els.modalCancel.classList.toggle("hidden", !showCancel);
    els.modalConfirm.classList.toggle("danger", Boolean(danger));
    els.modalBackdrop.classList.remove("hidden");

    return new Promise((resolve) => {
      modalState.resolver = resolve;
    });
  }

  function closeModal(result) {
    els.modalBackdrop.classList.add("hidden");
    if (modalState.resolver) {
      modalState.resolver(result);
      modalState.resolver = null;
    }
  }

  function openInfoModal(title, bodyHtml) {
    return openModal({
      title,
      bodyHtml,
      confirmText: "Закрыть",
      showCancel: false,
    });
  }

  function getFilteredTasks() {
    const query = state.globalSearch.trim().toLowerCase();

    const filtered = state.tasks.filter((task) => {
      if (task.archived) {
        return false;
      }

      if (query) {
        const haystack = `${task.task_code} ${task.title} ${task.description}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      const status = computeTaskStatus(task);
      if (state.tasksFilters.status !== "all" && status !== state.tasksFilters.status) {
        return false;
      }

      if (state.tasksFilters.type !== "all" && task.task_type !== state.tasksFilters.type) {
        return false;
      }

      if (state.tasksFilters.reward !== "all" && !task.reward_types.includes(state.tasksFilters.reward)) {
        return false;
      }

      if (state.tasksFilters.hasPoints === "yes" && !task.reward_types.includes("activity_points")) {
        return false;
      }

      if (state.tasksFilters.hasPoints === "no" && task.reward_types.includes("activity_points")) {
        return false;
      }

      if (state.tasksFilters.dateFrom) {
        const from = parseDate(`${state.tasksFilters.dateFrom}T00:00:00`);
        const taskTo = parseDate(task.active_to);
        if (from && taskTo && taskTo < from) {
          return false;
        }
      }

      if (state.tasksFilters.dateTo) {
        const to = parseDate(`${state.tasksFilters.dateTo}T23:59:59`);
        const taskFrom = parseDate(task.active_from);
        if (to && taskFrom && taskFrom > to) {
          return false;
        }
      }

      if (state.quickFilter === "active" && status !== "active") {
        return false;
      }

      if (state.quickFilter === "with_points" && !task.reward_types.includes("activity_points")) {
        return false;
      }

      if (state.quickFilter === "claim_window" && !hasClaimWindowTask(task)) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime();
    });

    return filtered;
  }

  function pruneSelectedTasks() {
    const allTaskIds = new Set(state.tasks.filter((task) => !task.archived).map((task) => task.id));
    for (const id of Array.from(state.selectedTaskIds)) {
      if (!allTaskIds.has(id)) {
        state.selectedTaskIds.delete(id);
      }
    }
  }

  function renderTasksTable() {
    pruneSelectedTasks();
    const tasks = getFilteredTasks();

    if (tasks.length === 0) {
      els.tasksTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="muted">По заданным фильтрам задания не найдены.</td>
        </tr>
      `;
      els.selectAllTasks.checked = false;
      els.selectedTasksCount.textContent = `${state.selectedTaskIds.size} выбрано`;
      return;
    }

    els.tasksTableBody.innerHTML = tasks
      .map((task) => {
        const taskStatus = computeTaskStatus(task);
        const isSelected = state.selectedTaskIds.has(task.id);

        return `
          <tr>
            <td>
              <input type="checkbox" class="task-select" data-task-id="${escapeHtml(task.id)}" ${isSelected ? "checked" : ""} />
            </td>
            <td><strong>${escapeHtml(task.task_code)}</strong></td>
            <td>${escapeHtml(task.title)}</td>
            <td>${escapeHtml(TASK_TYPE_LABELS[task.task_type] || task.task_type)}</td>
            <td>${formatDateTime(task.active_from)} - ${formatDateTime(task.active_to)}</td>
            <td>${rewardBadges(task.reward_types)}</td>
            <td>${task.priority}</td>
            <td>
              ${publicationBadge(task.publication_state)}
              ${statusBadge(taskStatus)}
              <span class="muted">${escapeHtml(task.status_mode)}</span>
            </td>
            <td>
              <div class="row-actions">
                <button type="button" data-action="view" data-task-id="${escapeHtml(task.id)}">Просмотр</button>
                <button type="button" data-action="edit" data-task-id="${escapeHtml(task.id)}">Редактировать</button>
                <button type="button" data-action="duplicate" data-task-id="${escapeHtml(task.id)}">Дублировать</button>
                <button type="button" data-action="archive" data-task-id="${escapeHtml(task.id)}">Архивировать</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    const visibleIds = tasks.map((task) => task.id);
    const selectedVisible = visibleIds.filter((id) => state.selectedTaskIds.has(id));
    els.selectAllTasks.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
    els.selectedTasksCount.textContent = `${state.selectedTaskIds.size} выбрано`;
  }

  function renderTasksFilters() {
    els.tasksStatusFilter.value = state.tasksFilters.status;
    els.tasksTypeFilter.value = state.tasksFilters.type;
    els.tasksRewardFilter.value = state.tasksFilters.reward;
    els.tasksDateFromFilter.value = state.tasksFilters.dateFrom;
    els.tasksDateToFilter.value = state.tasksFilters.dateTo;
    els.tasksHasPointsFilter.value = state.tasksFilters.hasPoints;

    for (const chip of els.quickFilters) {
      chip.classList.toggle("is-active", chip.dataset.quickFilter === state.quickFilter);
    }
  }

  function renderTasksScreen() {
    renderTasksFilters();
    renderTasksTable();
    renderCompletionTaskOptions();
  }

  function openTaskViewModal(taskId) {
    const task = getTaskById(taskId);
    if (!task) {
      return;
    }

    const status = computeTaskStatus(task);
    const payload = {
      ...task,
      computed_status: status,
      claim_window_days: CLAIM_WINDOW_DAYS,
    };

    openInfoModal(
      `Карточка ${task.task_code}`,
      `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`
    );
  }

  function startCreateTask() {
    state.editingTaskId = null;
    resetTaskForm();
    switchScreen("editor");
  }

  function startEditTask(taskId) {
    const task = getTaskById(taskId);
    if (!task) {
      return;
    }

    state.editingTaskId = taskId;
    fillTaskForm(task);
    switchScreen("editor");
  }

  async function duplicateTask(taskId) {
    const original = getTaskById(taskId);
    if (!original) {
      return;
    }

    const shouldDuplicate = await openModal({
      title: "Дублировать задание",
      bodyHtml: `Создать копию задания <strong>${escapeHtml(original.task_code)}</strong>?`,
      confirmText: "Дублировать",
      cancelText: "Отмена",
      showCancel: true,
    });

    if (!shouldDuplicate) {
      return;
    }

    const duplicate = {
      ...clone(original),
      id: generateTaskId(),
      task_code: `${original.task_code}_COPY`,
      publication_state: "draft",
      created_at: new Date().toISOString().slice(0, 16),
      status_mode: "auto",
      forced_status: "",
      simulated_status: "",
    };

    state.tasks.push(duplicate);
    showToast(`Создан дубликат ${duplicate.task_code}`);
    renderTasksScreen();
  }

  async function archiveTask(taskId) {
    const task = getTaskById(taskId);
    if (!task) {
      return;
    }

    const shouldArchive = await openModal({
      title: "Архивирование",
      bodyHtml: `Архивировать задание <strong>${escapeHtml(task.task_code)}</strong>?`,
      confirmText: "Архивировать",
      cancelText: "Отмена",
      showCancel: true,
      danger: true,
    });

    if (!shouldArchive) {
      return;
    }

    task.archived = true;
    state.selectedTaskIds.delete(task.id);
    showToast(`Задание ${task.task_code} архивировано`);
    renderTasksScreen();
  }

  async function archiveSelectedTasks() {
    if (state.selectedTaskIds.size === 0) {
      showToast("Выберите хотя бы одно задание для архивации");
      return;
    }

    const count = state.selectedTaskIds.size;
    const shouldArchive = await openModal({
      title: "Массовая архивация",
      bodyHtml: `Архивировать выбранные задания: <strong>${count}</strong>?`,
      confirmText: "Архивировать",
      cancelText: "Отмена",
      showCancel: true,
      danger: true,
    });

    if (!shouldArchive) {
      return;
    }

    state.tasks.forEach((task) => {
      if (state.selectedTaskIds.has(task.id)) {
        task.archived = true;
      }
    });

    state.selectedTaskIds.clear();
    showToast(`Архивировано заданий: ${count}`);
    renderTasksScreen();
  }

  function applyBulkPriority() {
    if (state.selectedTaskIds.size === 0) {
      showToast("Выберите задания для массового изменения приоритета");
      return;
    }

    const value = Number(els.bulkPriority.value);
    if (!Number.isInteger(value) || value < 0) {
      showToast("Введите корректный целочисленный приоритет >= 0");
      return;
    }

    state.tasks.forEach((task) => {
      if (state.selectedTaskIds.has(task.id)) {
        task.priority = value;
      }
    });

    showToast(`Приоритет обновлён для ${state.selectedTaskIds.size} заданий`);
    renderTasksScreen();
  }

  function collectTaskCsvRows(tasks) {
    return tasks.map((task) => ({
      task_code: task.task_code,
      title: task.title,
      task_type: task.task_type,
      active_from: task.active_from,
      active_to: task.active_to,
      reward_types: task.reward_types.join("|"),
      priority: task.priority,
      publication_state: task.publication_state,
      status_mode: task.status_mode,
      user_view_status: computeTaskStatus(task),
    }));
  }

  function exportTasksCsv() {
    const visibleTasks = getFilteredTasks();
    const selectedTasks = visibleTasks.filter((task) => state.selectedTaskIds.has(task.id));
    const target = selectedTasks.length > 0 ? selectedTasks : visibleTasks;

    if (target.length === 0) {
      showToast("Нет данных для экспорта");
      return;
    }

    downloadCsv("tasks_export.csv", collectTaskCsvRows(target));
    showToast(`CSV выгружен: ${target.length} записей`);
  }

  function renderConditionFields(taskType, values = {}) {
    let html = "";

    if (taskType === "add_to_cart" || taskType === "add_to_favorites") {
      html = `
        <div class="form-grid grid-1">
          <label>
            Количество товаров *
            <input id="conditionItemsCount" type="number" min="1" value="${escapeHtml(values.items_count ?? "")}" />
          </label>
        </div>
      `;
    }

    if (taskType === "purchase_amount") {
      html = `
        <div class="form-grid grid-1">
          <label>
            Минимальная сумма заказа (₽) *
            <input id="conditionMinAmount" type="number" min="1" value="${escapeHtml(values.min_amount ?? "")}" />
          </label>
        </div>
      `;
    }

    if (taskType === "purchase_category") {
      html = `
        <div class="form-grid grid-2">
          <label>
            category_id *
            <input id="conditionCategoryId" type="text" value="${escapeHtml(values.category_id ?? "")}" placeholder="electronics" />
          </label>
          <label>
            Минимальная сумма заказа (₽) *
            <input id="conditionMinAmount" type="number" min="1" value="${escapeHtml(values.min_amount ?? "")}" />
          </label>
        </div>
      `;
    }

    if (taskType === "purchase_seller") {
      html = `
        <div class="form-grid grid-2">
          <label>
            seller_id *
            <input id="conditionSellerId" type="text" value="${escapeHtml(values.seller_id ?? "")}" placeholder="seller-123" />
          </label>
          <label>
            Минимальная сумма заказа (₽) *
            <input id="conditionMinAmount" type="number" min="1" value="${escapeHtml(values.min_amount ?? "")}" />
          </label>
        </div>
      `;
    }

    if (taskType === "visit_url" || taskType === "visit_external_url") {
      html = `
        <div class="form-grid grid-1">
          <label>
            URL для проверки факта посещения *
            <input id="conditionUrl" type="url" value="${escapeHtml(values.url ?? "")}" placeholder="https://example.com" />
          </label>
        </div>
      `;
    }

    if (taskType === "visit_app_screen") {
      html = `
        <div class="form-grid grid-1">
          <label>
            app_screen *
            <input id="conditionAppScreen" type="text" value="${escapeHtml(values.app_screen ?? "")}" placeholder="profile/home" />
          </label>
        </div>
      `;
    }

    els.conditionFields.innerHTML = html;

    if (PURCHASE_TYPES.includes(taskType)) {
      els.purchasePeriodSection.classList.remove("hidden");
    } else {
      els.purchasePeriodSection.classList.add("hidden");
      els.purchaseFrom.value = "";
      els.purchaseTo.value = "";
    }
  }

  function renderRewardSections() {
    els.bonusSection.classList.toggle("hidden", !els.rewardBonus.checked);
    els.promoSection.classList.toggle("hidden", !els.rewardPromocode.checked);
    els.pointsSection.classList.toggle("hidden", !els.rewardPoints.checked);

    if (!els.rewardPromocode.checked) {
      els.promocodeCode.value = "";
      els.promocodeValidTo.value = "";
      els.promocodeTerms.value = "";
    }

    if (!els.rewardPoints.checked) {
      els.pointsAmount.value = "";
      els.pointsExpireAt.value = "";
    }

    if (!els.rewardBonus.checked) {
      els.bonusAmount.value = "";
    }
  }

  function renderStatusMode() {
    const mode = getSelectedStatusMode();
    const isForce = mode === "force";
    els.forceStatusWrap.classList.toggle("hidden", !isForce);
    els.forceWarning.classList.toggle("hidden", !isForce);
    if (!isForce) {
      els.forcedStatus.value = "";
    }
  }

  function setImagePreview(src) {
    if (!src) {
      els.imagePreview.innerHTML = "Превью изображения";
      return;
    }
    els.imagePreview.innerHTML = `<img src="${escapeHtml(src)}" alt="Task image preview" />`;
  }

  function clearFieldErrors() {
    els.formErrorsPanel.classList.add("hidden");
    els.formErrors.innerHTML = "";
    for (const item of Array.from(els.taskForm.querySelectorAll(".has-error"))) {
      item.classList.remove("has-error");
    }
  }

  function setFieldError(fieldId, message, errors) {
    errors.push({ fieldId, message });
  }

  function gatherConditionByTaskType(taskType) {
    if (taskType === "add_to_cart" || taskType === "add_to_favorites") {
      return {
        items_count: Number(document.getElementById("conditionItemsCount")?.value || 0),
      };
    }

    if (taskType === "purchase_amount") {
      return {
        min_amount: Number(document.getElementById("conditionMinAmount")?.value || 0),
      };
    }

    if (taskType === "purchase_category") {
      return {
        category_id: (document.getElementById("conditionCategoryId")?.value || "").trim(),
        min_amount: Number(document.getElementById("conditionMinAmount")?.value || 0),
      };
    }

    if (taskType === "purchase_seller") {
      return {
        seller_id: (document.getElementById("conditionSellerId")?.value || "").trim(),
        min_amount: Number(document.getElementById("conditionMinAmount")?.value || 0),
      };
    }

    if (taskType === "visit_url" || taskType === "visit_external_url") {
      return {
        url: (document.getElementById("conditionUrl")?.value || "").trim(),
      };
    }

    if (taskType === "visit_app_screen") {
      return {
        app_screen: (document.getElementById("conditionAppScreen")?.value || "").trim(),
      };
    }

    return {};
  }

  function collectFormData() {
    const rewardTypes = [];
    if (els.rewardBonus.checked) {
      rewardTypes.push("bonus");
    }
    if (els.rewardPromocode.checked) {
      rewardTypes.push("promocode");
    }
    if (els.rewardPoints.checked) {
      rewardTypes.push("activity_points");
    }

    const taskType = els.taskType.value;
    const conditions = gatherConditionByTaskType(taskType);

    const rewardParams = {};
    if (els.rewardBonus.checked && els.bonusAmount.value) {
      rewardParams.bonus_amount = Number(els.bonusAmount.value);
    }
    if (els.rewardPromocode.checked) {
      rewardParams.promocode_code = els.promocodeCode.value.trim();
      rewardParams.promocode_valid_to = els.promocodeValidTo.value;
      rewardParams.promocode_terms = els.promocodeTerms.value.trim();
    }
    if (els.rewardPoints.checked) {
      rewardParams.activity_points_amount = Number(els.pointsAmount.value || 0);
      rewardParams.activity_points_expire_at = els.pointsExpireAt.value;
    }

    const statusMode = getSelectedStatusMode();

    return {
      task_code: els.taskCode.value.trim(),
      title: els.taskTitle.value.trim(),
      description: els.taskDescription.value.trim(),
      image_url: els.imageUrl.value.trim(),
      active_from: els.activeFrom.value,
      active_to: els.activeTo.value,
      task_type: taskType,
      conditions,
      purchase_period_from: PURCHASE_TYPES.includes(taskType) ? els.purchaseFrom.value : null,
      purchase_period_to: PURCHASE_TYPES.includes(taskType) ? els.purchaseTo.value : null,
      reward_types: rewardTypes,
      reward_params: rewardParams,
      target_type: els.targetType.value,
      target_value: els.targetValue.value.trim(),
      priority: Number(els.priority.value),
      publication_state: els.publicationState.value,
      status_mode: statusMode,
      forced_status: statusMode === "force" ? els.forcedStatus.value : "",
      simulated_status: els.simulatedStatus.value,
    };
  }

  function validateForm(formData) {
    const errors = [];

    if (!formData.task_code) {
      setFieldError("taskCode", "Поле task_code обязательно", errors);
    }

    const duplicate = state.tasks.find(
      (task) => !task.archived && task.task_code === formData.task_code && task.id !== state.editingTaskId
    );
    if (duplicate) {
      setFieldError("taskCode", "task_code должен быть уникальным", errors);
    }

    if (!formData.title) {
      setFieldError("taskTitle", "Заголовок обязателен", errors);
    }

    if (!formData.description) {
      setFieldError("taskDescription", "Описание обязательно", errors);
    }

    if (!formData.active_from) {
      setFieldError("activeFrom", "active_from обязателен", errors);
    }

    if (!formData.active_to) {
      setFieldError("activeTo", "active_to обязателен", errors);
    }

    const activeFromDate = parseDate(formData.active_from);
    const activeToDate = parseDate(formData.active_to);
    if (activeFromDate && activeToDate && activeFromDate >= activeToDate) {
      setFieldError("activeTo", "active_to должен быть позже active_from", errors);
    }

    if (!Number.isInteger(formData.priority) || formData.priority < 0) {
      setFieldError("priority", "Приоритет должен быть целым числом >= 0", errors);
    }

    if (formData.task_type === "add_to_cart" || formData.task_type === "add_to_favorites") {
      if (!Number.isInteger(formData.conditions.items_count) || formData.conditions.items_count <= 0) {
        setFieldError("conditionItemsCount", "Укажите количество товаров > 0", errors);
      }
    }

    if (formData.task_type === "purchase_amount") {
      if (!Number.isFinite(formData.conditions.min_amount) || formData.conditions.min_amount <= 0) {
        setFieldError("conditionMinAmount", "Укажите сумму заказа > 0", errors);
      }
    }

    if (formData.task_type === "purchase_category") {
      if (!formData.conditions.category_id) {
        setFieldError("conditionCategoryId", "category_id обязателен", errors);
      }
      if (!Number.isFinite(formData.conditions.min_amount) || formData.conditions.min_amount <= 0) {
        setFieldError("conditionMinAmount", "Укажите сумму заказа > 0", errors);
      }
    }

    if (formData.task_type === "purchase_seller") {
      if (!formData.conditions.seller_id) {
        setFieldError("conditionSellerId", "seller_id обязателен", errors);
      }
      if (!Number.isFinite(formData.conditions.min_amount) || formData.conditions.min_amount <= 0) {
        setFieldError("conditionMinAmount", "Укажите сумму заказа > 0", errors);
      }
    }

    if (formData.task_type === "visit_url" || formData.task_type === "visit_external_url") {
      if (!formData.conditions.url || !isValidUrl(formData.conditions.url)) {
        setFieldError("conditionUrl", "Укажите корректный URL", errors);
      }
    }

    if (formData.task_type === "visit_app_screen") {
      if (!formData.conditions.app_screen) {
        setFieldError("conditionAppScreen", "app_screen обязателен", errors);
      }
    }

    if (PURCHASE_TYPES.includes(formData.task_type)) {
      if (!formData.purchase_period_from) {
        setFieldError("purchaseFrom", "purchase_period_from обязателен для purchase-заданий", errors);
      }
      if (!formData.purchase_period_to) {
        setFieldError("purchaseTo", "purchase_period_to обязателен для purchase-заданий", errors);
      }
      if (formData.purchase_period_from && formData.purchase_period_to) {
        const purchaseFrom = parseDate(formData.purchase_period_from);
        const purchaseTo = parseDate(formData.purchase_period_to);
        if (purchaseFrom && purchaseTo && purchaseFrom > purchaseTo) {
          setFieldError("purchaseTo", "purchase_period_to не может быть раньше purchase_period_from", errors);
        }
      }
    }

    if (!formData.target_value) {
      setFieldError("targetValue", "target_value обязателен", errors);
    }

    if (formData.target_type === "internal_url" && formData.target_value && !formData.target_value.startsWith("/")) {
      setFieldError("targetValue", "Для internal_url значение должно начинаться с /", errors);
    }

    if (formData.target_type === "external_url" && formData.target_value && !isValidUrl(formData.target_value)) {
      setFieldError("targetValue", "Для external_url укажите корректный URL", errors);
    }

    if (formData.reward_types.length === 0) {
      setFieldError("rewardBonus", "Выберите хотя бы один тип награды", errors);
    }

    if (formData.reward_types.includes("promocode")) {
      if (!formData.reward_params.promocode_code) {
        setFieldError("promocodeCode", "Код промокода обязателен", errors);
      }
      if (!formData.reward_params.promocode_valid_to) {
        setFieldError("promocodeValidTo", "Срок действия промокода обязателен", errors);
      }
      if (!formData.reward_params.promocode_terms) {
        setFieldError("promocodeTerms", "Условия промокода обязательны", errors);
      }
    }

    if (formData.reward_types.includes("activity_points")) {
      if (!Number.isFinite(formData.reward_params.activity_points_amount) || formData.reward_params.activity_points_amount <= 0) {
        setFieldError("pointsAmount", "Количество очков должно быть > 0", errors);
      }
      if (!formData.reward_params.activity_points_expire_at) {
        setFieldError("pointsExpireAt", "Срок сгорания очков обязателен", errors);
      }
    }

    if (formData.status_mode === "force" && !formData.forced_status) {
      setFieldError("forcedStatus", "При режиме Force нужно выбрать статус", errors);
    }

    return errors;
  }

  function renderFormErrors(errors) {
    clearFieldErrors();

    if (errors.length === 0) {
      return;
    }

    els.formErrorsPanel.classList.remove("hidden");
    els.formErrors.innerHTML = errors.map((error) => `<li>${escapeHtml(error.message)}</li>`).join("");

    for (const error of errors) {
      const field = document.getElementById(error.fieldId);
      if (field) {
        field.classList.add("has-error");
      }
    }
  }

  function generateTaskId() {
    return `task_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString().slice(-4)}`;
  }

  function resetTaskForm() {
    clearFieldErrors();
    els.editorTitle.textContent = "Создать задание";
    els.taskForm.reset();

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 86400000);

    els.taskCode.value = "";
    els.taskCode.readOnly = false;
    els.taskCodeHint.textContent = "Уникальное значение. После публикации редактирование блокируется.";
    els.activeFrom.value = toLocalDateTimeInput(now);
    els.activeTo.value = toLocalDateTimeInput(in7Days);
    els.priority.value = "50";
    els.publicationState.value = "draft";
    els.simulatedStatus.value = "";
    els.targetType.value = "internal_url";
    els.targetValue.value = "/";

    els.rewardBonus.checked = false;
    els.rewardPromocode.checked = false;
    els.rewardPoints.checked = false;

    els.statusModeRadios.forEach((radio) => {
      radio.checked = radio.value === "auto";
    });

    renderConditionFields(els.taskType.value);
    renderRewardSections();
    renderStatusMode();
    setImagePreview("");
  }

  function fillTaskForm(task) {
    clearFieldErrors();
    els.editorTitle.textContent = `Редактирование: ${task.task_code}`;

    els.taskCode.value = task.task_code;
    els.taskTitle.value = task.title;
    els.taskDescription.value = task.description;
    els.imageUrl.value = task.image_url || "";
    setImagePreview(task.image_url || "");
    els.priority.value = String(task.priority);

    els.activeFrom.value = toIsoDateTimeInput(task.active_from);
    els.activeTo.value = toIsoDateTimeInput(task.active_to);

    els.taskType.value = task.task_type;
    renderConditionFields(task.task_type, task.conditions);

    els.targetType.value = task.target_type;
    els.targetValue.value = task.target_value;

    els.purchaseFrom.value = task.purchase_period_from || "";
    els.purchaseTo.value = task.purchase_period_to || "";

    els.rewardBonus.checked = task.reward_types.includes("bonus");
    els.rewardPromocode.checked = task.reward_types.includes("promocode");
    els.rewardPoints.checked = task.reward_types.includes("activity_points");

    els.bonusAmount.value = task.reward_params.bonus_amount || "";
    els.promocodeCode.value = task.reward_params.promocode_code || "";
    els.promocodeValidTo.value = task.reward_params.promocode_valid_to || "";
    els.promocodeTerms.value = task.reward_params.promocode_terms || "";
    els.pointsAmount.value = task.reward_params.activity_points_amount || "";
    els.pointsExpireAt.value = task.reward_params.activity_points_expire_at || "";

    els.publicationState.value = task.publication_state;
    els.simulatedStatus.value = task.simulated_status || "";

    els.statusModeRadios.forEach((radio) => {
      radio.checked = radio.value === task.status_mode;
    });
    els.forcedStatus.value = task.forced_status || "";
    renderRewardSections();
    renderStatusMode();

    const isPublished = task.publication_state === "published";
    els.taskCode.readOnly = isPublished;
    els.taskCodeHint.textContent = isPublished
      ? "task_code заблокирован, потому что задание уже опубликовано"
      : "Уникальное значение. После публикации редактирование блокируется.";
  }

  function upsertTask(formData, publishRequested) {
    const publicationState = publishRequested ? "published" : "draft";

    const payload = {
      id: state.editingTaskId || generateTaskId(),
      task_code: formData.task_code,
      title: formData.title,
      description: formData.description,
      image_url: formData.image_url,
      active_from: formData.active_from,
      active_to: formData.active_to,
      task_type: formData.task_type,
      conditions: formData.conditions,
      purchase_period_from: formData.purchase_period_from,
      purchase_period_to: formData.purchase_period_to,
      reward_types: formData.reward_types,
      reward_params: formData.reward_params,
      target_type: formData.target_type,
      target_value: formData.target_value,
      priority: formData.priority,
      status_mode: formData.status_mode,
      forced_status: formData.status_mode === "force" ? formData.forced_status : "",
      simulated_status: formData.simulated_status || "",
      publication_state: publicationState,
      archived: false,
      created_at: state.editingTaskId
        ? getTaskById(state.editingTaskId).created_at
        : new Date().toISOString().slice(0, 16),
    };

    if (state.editingTaskId) {
      const index = state.tasks.findIndex((task) => task.id === state.editingTaskId);
      if (index >= 0) {
        state.tasks[index] = {
          ...state.tasks[index],
          ...payload,
        };
      }
    } else {
      state.tasks.push(payload);
    }
  }

  function submitTaskForm(publishRequested) {
    const formData = collectFormData();
    const errors = validateForm(formData);

    if (errors.length > 0) {
      renderFormErrors(errors);
      showToast("Форма содержит ошибки. Исправьте поля и повторите.");
      return;
    }

    upsertTask(formData, publishRequested);
    const message = publishRequested ? "Задание опубликовано" : "Черновик сохранён";
    showToast(message);

    state.editingTaskId = null;
    resetTaskForm();
    switchScreen("tasks");
    renderTasksScreen();
  }

  function applyPresetVisitPromoPoints() {
    state.editingTaskId = null;
    resetTaskForm();
    switchScreen("editor");

    els.taskCode.value = "VISIT_URL_PROMO_POINTS_DEMO";
    els.taskTitle.value = "Посетить страницу акции и забрать награду";
    els.taskDescription.value = "Сценарий для демонстрации: visit_url + promocode + activity_points";
    els.taskType.value = "visit_url";
    renderConditionFields("visit_url", { url: "https://05.ru/promo/demo" });
    els.targetType.value = "internal_url";
    els.targetValue.value = "/promo/demo";
    els.rewardPromocode.checked = true;
    els.rewardPoints.checked = true;
    renderRewardSections();
    els.promocodeCode.value = "DEMO-10";
    els.promocodeValidTo.value = "2026-04-30";
    els.promocodeTerms.value = "Скидка 10% при заказе от 3000 ₽";
    els.pointsAmount.value = "40";
    els.pointsExpireAt.value = "2026-04-15";
    els.priority.value = "88";
    showToast("Шаблон сценария visit_url + promocode + activity_points заполнен");
  }

  function applyPresetPurchaseTask() {
    state.editingTaskId = null;
    resetTaskForm();
    switchScreen("editor");

    els.taskCode.value = "PURCHASE_FIXED_PERIOD_DEMO";
    els.taskTitle.value = "Покупка в категории с фиксированным окном";
    els.taskDescription.value = "Сценарий для демонстрации purchase-задачи с фиксированным purchase_period";
    els.taskType.value = "purchase_category";
    renderConditionFields("purchase_category", { category_id: "home-appliances", min_amount: 10000 });
    els.purchaseFrom.value = "2026-03-01";
    els.purchaseTo.value = "2026-03-15";
    els.targetType.value = "internal_url";
    els.targetValue.value = "/catalog/home-appliances";
    els.rewardBonus.checked = true;
    els.rewardPoints.checked = true;
    renderRewardSections();
    els.bonusAmount.value = "700";
    els.pointsAmount.value = "90";
    els.pointsExpireAt.value = "2026-05-01";
    els.priority.value = "92";
    showToast("Шаблон purchase-сценария заполнен");
  }

  function renderCompletionTaskOptions() {
    const availableTasks = state.tasks.filter((task) => !task.archived);

    if (availableTasks.length === 0) {
      els.completionTaskSelect.innerHTML = `<option value="">Нет доступных заданий</option>`;
      state.completion.taskId = "";
      return;
    }

    els.completionTaskSelect.innerHTML = availableTasks
      .map((task) => `<option value="${escapeHtml(task.id)}">${escapeHtml(task.task_code)} — ${escapeHtml(task.title)}</option>`)
      .join("");

    if (!state.completion.taskId || !availableTasks.some((task) => task.id === state.completion.taskId)) {
      state.completion.taskId = availableTasks[0].id;
    }

    els.completionTaskSelect.value = state.completion.taskId;
  }

  function getFilteredCompletionRows() {
    if (!state.completion.taskId) {
      return [];
    }

    const query = state.globalSearch.trim().toLowerCase();

    return state.taskUserStates.filter((row) => {
      if (row.task_id !== state.completion.taskId) {
        return false;
      }

      if (query) {
        const haystack = `${row.user_id} ${row.phone}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      const effectiveStatus = getEffectiveUserStatus(row);
      if (state.completion.status !== "all" && effectiveStatus !== state.completion.status) {
        return false;
      }

      if (state.completion.unclaimedOnly && !(effectiveStatus === "completed" && !row.reward_claimed_at)) {
        return false;
      }

      if (state.completion.dateFrom && row.completed_at) {
        if (!isWithinDateRange(row.completed_at, state.completion.dateFrom, "")) {
          return false;
        }
      }

      if (state.completion.dateFrom && !row.completed_at) {
        return false;
      }

      if (state.completion.dateTo && row.completed_at) {
        if (!isWithinDateRange(row.completed_at, "", state.completion.dateTo)) {
          return false;
        }
      }

      if (state.completion.dateTo && !row.completed_at) {
        return false;
      }

      return true;
    });
  }

  function renderCompletionSummary() {
    const taskId = state.completion.taskId;
    const rows = state.taskUserStates.filter((row) => row.task_id === taskId);
    let completedCount = 0;
    let claimWindowCount = 0;
    let expiredCount = 0;

    for (const row of rows) {
      const status = getEffectiveUserStatus(row);
      if (status === "completed") {
        completedCount += 1;
      }

      if (status === "completed") {
        const left = daysLeft(row.claim_window_until);
        if (left !== null && left >= 0) {
          claimWindowCount += 1;
        }
      }

      if (status === "expired") {
        expiredCount += 1;
      }
    }

    els.completionSummaryCompleted.textContent = String(completedCount);
    els.completionSummaryClaimWindow.textContent = String(claimWindowCount);
    els.completionSummaryExpired.textContent = String(expiredCount);
  }

  function renderCompletionTable() {
    const rows = getFilteredCompletionRows();

    if (rows.length === 0) {
      els.completionTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="muted">Нет пользователей по заданным условиям.</td>
        </tr>
      `;
      return;
    }

    els.completionTableBody.innerHTML = rows
      .map((row) => {
        const effectiveStatus = getEffectiveUserStatus(row);
        const left = effectiveStatus === "completed" ? daysLeft(row.claim_window_until) : null;
        const daysCell = left === null ? "—" : left < 0 ? "0" : String(left);

        return `
          <tr>
            <td>${escapeHtml(row.user_id)}</td>
            <td>${escapeHtml(row.phone)}</td>
            <td>${statusBadge(effectiveStatus)}</td>
            <td>${formatDateTime(row.completed_at)}</td>
            <td>${formatDateTime(row.reward_claimed_at)}</td>
            <td>${escapeHtml(daysCell)}</td>
            <td>
              <div class="row-actions">
                <button type="button" data-action="view-user-state" data-task-id="${escapeHtml(
                  row.task_id
                )}" data-user-id="${escapeHtml(row.user_id)}">Карточка</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderCompletionScreen() {
    renderCompletionTaskOptions();
    renderCompletionSummary();
    renderCompletionTable();
  }

  function viewUserState(taskId, userId) {
    const row = state.taskUserStates.find((item) => item.task_id === taskId && item.user_id === userId);
    const task = getTaskById(taskId);
    if (!row || !task) {
      return;
    }

    const effectiveStatus = getEffectiveUserStatus(row);
    const payload = {
      task_code: task.task_code,
      user_id: row.user_id,
      phone: row.phone,
      status_original: row.status,
      status_effective: effectiveStatus,
      completed_at: row.completed_at,
      reward_claimed_at: row.reward_claimed_at,
      claim_window_until: row.claim_window_until,
      days_left_to_claim: daysLeft(row.claim_window_until),
      reward_types: task.reward_types,
    };

    openInfoModal("Карточка выполнения", `<pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>`);
  }

  function exportCompletionCsv() {
    const rows = getFilteredCompletionRows();
    if (rows.length === 0) {
      showToast("Нет строк для экспорта");
      return;
    }

    const task = getTaskById(state.completion.taskId);
    const csvRows = rows.map((row) => ({
      task_code: task ? task.task_code : row.task_id,
      user_id: row.user_id,
      phone: row.phone,
      status: getEffectiveUserStatus(row),
      completed_at: row.completed_at || "",
      reward_claimed_at: row.reward_claimed_at || "",
      claim_window_until: row.claim_window_until || "",
      days_left_to_claim: daysLeft(row.claim_window_until) ?? "",
    }));

    downloadCsv("task_completion_export.csv", csvRows);
    showToast(`CSV выгружен: ${rows.length} записей`);
  }

  function buildUsersSnapshot() {
    return state.users.map((user) => {
      const activePointEntries = user.points_history.filter((entry) => {
        if (!entry.expires_at) {
          return entry.points > 0;
        }
        const expireDate = parseDate(entry.expires_at);
        return entry.points > 0 && expireDate && expireDate >= DEMO_NOW;
      });

      const pointsAvailable = activePointEntries.reduce((sum, entry) => sum + Number(entry.points || 0), 0);
      const expiries = activePointEntries.map((entry) => parseDate(entry.expires_at)).filter(Boolean);
      expiries.sort((a, b) => a.getTime() - b.getTime());

      const nearestExpiry = expiries.length > 0 ? expiries[0] : null;
      const pointsExpiringSoon = activePointEntries
        .filter((entry) => {
          const expire = parseDate(entry.expires_at);
          if (!expire) {
            return false;
          }
          const diff = Math.ceil((expire.getTime() - DEMO_NOW.getTime()) / 86400000);
          return diff >= 0 && diff <= 7;
        })
        .reduce((sum, entry) => sum + Number(entry.points || 0), 0);

      const completedTasks = new Set(
        state.taskUserStates
          .filter((item) => item.user_id === user.user_id)
          .filter((item) => {
            const status = getEffectiveUserStatus(item);
            return ["completed", "reward_claimed", "expired"].includes(status);
          })
          .map((item) => item.task_id)
      );

      return {
        ...user,
        points_available: pointsAvailable,
        points_expiring_soon: pointsExpiringSoon,
        expiry_nearest_date: nearestExpiry ? nearestExpiry.toISOString().slice(0, 10) : "",
        completed_tasks: completedTasks.size,
      };
    });
  }

  function getFilteredUsersSnapshot() {
    const snapshot = buildUsersSnapshot();
    const query = state.globalSearch.trim().toLowerCase();

    return snapshot.filter((row) => {
      if (query) {
        const haystack = `${row.user_id} ${row.phone}`.toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }

      if (state.usersFilters.phone) {
        const filterPhone = state.usersFilters.phone.trim().toLowerCase();
        if (!row.phone.toLowerCase().includes(filterPhone)) {
          return false;
        }
      }

      if (state.usersFilters.minPoints !== "" && row.points_available < Number(state.usersFilters.minPoints)) {
        return false;
      }

      if (state.usersFilters.maxPoints !== "" && row.points_available > Number(state.usersFilters.maxPoints)) {
        return false;
      }

      if (state.usersFilters.expiringDays !== "") {
        const days = Number(state.usersFilters.expiringDays);
        if (!Number.isFinite(days) || days < 1) {
          return false;
        }

        if (!row.expiry_nearest_date) {
          return false;
        }

        const nearest = parseDate(row.expiry_nearest_date);
        const diff = Math.ceil((nearest.getTime() - DEMO_NOW.getTime()) / 86400000);
        if (diff < 0 || diff > days) {
          return false;
        }
      }

      return true;
    });
  }

  function renderUsersTable() {
    const rows = getFilteredUsersSnapshot();

    if (rows.length === 0) {
      els.usersTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="muted">Нет пользователей по заданным фильтрам.</td>
        </tr>
      `;
      return;
    }

    els.usersTableBody.innerHTML = rows
      .map((row) => {
        return `
          <tr>
            <td>${escapeHtml(row.user_id)}</td>
            <td>${escapeHtml(row.phone)}</td>
            <td><strong>${row.points_available}</strong></td>
            <td>${row.points_expiring_soon}</td>
            <td>${formatDate(row.expiry_nearest_date)}</td>
            <td>${row.completed_tasks}</td>
            <td>
              <div class="row-actions">
                <button type="button" data-action="view-user" data-user-id="${escapeHtml(row.user_id)}">Детали</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderUserDetail() {
    if (!state.selectedUserId) {
      els.userDetailPanel.innerHTML = `
        <h3>Карточка пользователя</h3>
        <p class="muted">Выберите пользователя в таблице, чтобы увидеть историю очков и задания-источники.</p>
      `;
      return;
    }

    const snapshot = buildUsersSnapshot().find((user) => user.user_id === state.selectedUserId);
    if (!snapshot) {
      els.userDetailPanel.innerHTML = `
        <h3>Карточка пользователя</h3>
        <p class="muted">Пользователь не найден.</p>
      `;
      return;
    }

    const sourceRows = snapshot.points_history
      .map((entry) => {
        const expireDate = parseDate(entry.expires_at);
        const isExpired = expireDate ? expireDate < DEMO_NOW : false;
        return `
          <tr>
            <td>${formatDate(entry.date)}</td>
            <td>${escapeHtml(entry.task_code)}</td>
            <td>${entry.points}</td>
            <td>${formatDate(entry.expires_at)}</td>
            <td>${isExpired ? "expired" : "active"}</td>
          </tr>
        `;
      })
      .join("");

    const completedTaskCodes = Array.from(
      new Set(
        state.taskUserStates
          .filter((item) => item.user_id === snapshot.user_id)
          .map((item) => {
            const task = getTaskById(item.task_id);
            return task ? task.task_code : item.task_id;
          })
      )
    );

    els.userDetailPanel.innerHTML = `
      <h3>Карточка пользователя</h3>
      <div class="detail-block">
        <div class="detail-kv"><strong>user_id</strong><span>${escapeHtml(snapshot.user_id)}</span></div>
        <div class="detail-kv"><strong>Телефон</strong><span>${escapeHtml(snapshot.phone)}</span></div>
        <div class="detail-kv"><strong>Доступные очки</strong><span>${snapshot.points_available}</span></div>
        <div class="detail-kv"><strong>Сгорает скоро</strong><span>${snapshot.points_expiring_soon}</span></div>
        <div class="detail-kv"><strong>Ближайшая дата сгорания</strong><span>${formatDate(
          snapshot.expiry_nearest_date
        )}</span></div>
        <div class="detail-kv"><strong>Выполнено заданий</strong><span>${snapshot.completed_tasks}</span></div>
      </div>

      <h4>История очков</h4>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Дата</th>
              <th>Источник</th>
              <th>Очки</th>
              <th>Сгорание</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>${
            sourceRows || '<tr><td colspan="5" class="muted">История очков отсутствует.</td></tr>'
          }</tbody>
        </table>
      </div>

      <h4>Задания-источники</h4>
      <p>${
        completedTaskCodes.length > 0
          ? completedTaskCodes.map((code) => `<span class="badge reward">${escapeHtml(code)}</span>`).join(" ")
          : '<span class="muted">Нет связанных заданий</span>'
      }</p>
    `;
  }

  function renderUsersScreen() {
    renderUsersTable();
    renderUserDetail();
  }

  function renderCurrentScreen() {
    if (state.screen === "tasks") {
      renderTasksScreen();
      return;
    }

    if (state.screen === "editor") {
      renderStatusMode();
      renderRewardSections();
      return;
    }

    if (state.screen === "completions") {
      renderCompletionScreen();
      return;
    }

    if (state.screen === "users") {
      renderUsersScreen();
    }
  }

  function switchScreen(screenName) {
    state.screen = screenName;
    for (const [key, element] of Object.entries(els.screens)) {
      element.classList.toggle("is-active", key === screenName);
    }

    for (const button of els.navLinks) {
      button.classList.toggle("is-active", button.dataset.screen === screenName);
    }

    els.quickFiltersWrap.classList.toggle("hidden", screenName !== "tasks");
    renderCurrentScreen();
  }

  function downloadCsv(filename, rows) {
    if (!rows.length) {
      return;
    }

    const headers = Object.keys(rows[0]);
    const toCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => toCell(row[header])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function fillTypeAndRewardFilters() {
    els.tasksTypeFilter.innerHTML = `<option value="all">Все</option>${data.dictionaries.taskTypes
      .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
      .join("")}`;

    els.taskType.innerHTML = data.dictionaries.taskTypes
      .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
      .join("");

    els.tasksRewardFilter.innerHTML = `<option value="all">Все</option>${data.dictionaries.rewardTypes
      .map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`)
      .join("")}`;
  }

  function bindGlobalEvents() {
    els.navLinks.forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.screen;
        if (next === "editor" && !state.editingTaskId) {
          startCreateTask();
          return;
        }
        switchScreen(next);
      });
    });

    els.createTaskQuick.addEventListener("click", startCreateTask);

    els.globalSearch.addEventListener("input", (event) => {
      state.globalSearch = event.target.value;
      renderCurrentScreen();
    });

    els.quickFilters.forEach((chip) => {
      chip.addEventListener("click", () => {
        state.quickFilter = chip.dataset.quickFilter;
        renderTasksScreen();
      });
    });

    els.modalCancel.addEventListener("click", () => closeModal(false));
    els.modalConfirm.addEventListener("click", () => closeModal(true));
    els.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === els.modalBackdrop) {
        closeModal(false);
      }
    });
  }

  function bindTasksScreenEvents() {
    const filterInputs = [
      els.tasksStatusFilter,
      els.tasksTypeFilter,
      els.tasksRewardFilter,
      els.tasksDateFromFilter,
      els.tasksDateToFilter,
      els.tasksHasPointsFilter,
    ];

    filterInputs.forEach((input) => {
      input.addEventListener("change", () => {
        state.tasksFilters = {
          status: els.tasksStatusFilter.value,
          type: els.tasksTypeFilter.value,
          reward: els.tasksRewardFilter.value,
          dateFrom: els.tasksDateFromFilter.value,
          dateTo: els.tasksDateToFilter.value,
          hasPoints: els.tasksHasPointsFilter.value,
        };
        renderTasksScreen();
      });
    });

    els.tasksResetFilters.addEventListener("click", () => {
      state.tasksFilters = {
        status: "all",
        type: "all",
        reward: "all",
        dateFrom: "",
        dateTo: "",
        hasPoints: "all",
      };
      state.quickFilter = "all";
      renderTasksScreen();
    });

    els.selectAllTasks.addEventListener("change", () => {
      const visibleIds = getFilteredTasks().map((task) => task.id);
      if (els.selectAllTasks.checked) {
        visibleIds.forEach((id) => state.selectedTaskIds.add(id));
      } else {
        visibleIds.forEach((id) => state.selectedTaskIds.delete(id));
      }
      renderTasksScreen();
    });

    els.tasksTableBody.addEventListener("change", (event) => {
      const checkbox = event.target.closest(".task-select");
      if (!checkbox) {
        return;
      }
      const taskId = checkbox.dataset.taskId;
      if (checkbox.checked) {
        state.selectedTaskIds.add(taskId);
      } else {
        state.selectedTaskIds.delete(taskId);
      }
      renderTasksScreen();
    });

    els.tasksTableBody.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }
      const { action, taskId } = button.dataset;

      if (action === "view") {
        openTaskViewModal(taskId);
        return;
      }
      if (action === "edit") {
        startEditTask(taskId);
        return;
      }
      if (action === "duplicate") {
        await duplicateTask(taskId);
        return;
      }
      if (action === "archive") {
        await archiveTask(taskId);
      }
    });

    els.bulkApplyPriority.addEventListener("click", applyBulkPriority);
    els.bulkArchive.addEventListener("click", archiveSelectedTasks);
    els.tasksExportCsv.addEventListener("click", exportTasksCsv);
  }

  function bindEditorEvents() {
    els.taskType.addEventListener("change", () => {
      renderConditionFields(els.taskType.value);
    });

    [els.rewardBonus, els.rewardPromocode, els.rewardPoints].forEach((checkbox) => {
      checkbox.addEventListener("change", renderRewardSections);
    });

    els.statusModeRadios.forEach((radio) => {
      radio.addEventListener("change", renderStatusMode);
    });

    els.imageUrl.addEventListener("input", () => {
      if (els.imageUrl.value.trim()) {
        setImagePreview(els.imageUrl.value.trim());
      } else {
        setImagePreview("");
      }
    });

    els.imageFile.addEventListener("change", () => {
      const file = els.imageFile.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = typeof reader.result === "string" ? reader.result : "";
        setImagePreview(src);
      };
      reader.readAsDataURL(file);
    });

    els.saveDraftBtn.addEventListener("click", () => submitTaskForm(false));
    els.publishTaskBtn.addEventListener("click", () => submitTaskForm(true));
    els.cancelEditBtn.addEventListener("click", () => {
      state.editingTaskId = null;
      resetTaskForm();
      switchScreen("tasks");
    });

    els.presetVisitPromoPoints.addEventListener("click", applyPresetVisitPromoPoints);
    els.presetPurchaseTask.addEventListener("click", applyPresetPurchaseTask);
  }

  function bindCompletionEvents() {
    els.completionTaskSelect.addEventListener("change", () => {
      state.completion.taskId = els.completionTaskSelect.value;
      renderCompletionScreen();
    });

    els.completionStatusFilter.addEventListener("change", () => {
      state.completion.status = els.completionStatusFilter.value;
      renderCompletionTable();
    });

    els.completionDateFrom.addEventListener("change", () => {
      state.completion.dateFrom = els.completionDateFrom.value;
      renderCompletionTable();
    });

    els.completionDateTo.addEventListener("change", () => {
      state.completion.dateTo = els.completionDateTo.value;
      renderCompletionTable();
    });

    els.completionUnclaimedOnly.addEventListener("change", () => {
      state.completion.unclaimedOnly = els.completionUnclaimedOnly.checked;
      renderCompletionTable();
    });

    els.completionResetFilters.addEventListener("click", () => {
      state.completion.status = "all";
      state.completion.dateFrom = "";
      state.completion.dateTo = "";
      state.completion.unclaimedOnly = false;

      els.completionStatusFilter.value = "all";
      els.completionDateFrom.value = "";
      els.completionDateTo.value = "";
      els.completionUnclaimedOnly.checked = false;

      renderCompletionTable();
    });

    els.completionExportCsv.addEventListener("click", exportCompletionCsv);

    els.completionTableBody.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='view-user-state']");
      if (!button) {
        return;
      }
      viewUserState(button.dataset.taskId, button.dataset.userId);
    });
  }

  function bindUsersEvents() {
    els.usersMinPoints.addEventListener("input", () => {
      state.usersFilters.minPoints = els.usersMinPoints.value;
      renderUsersTable();
      renderUserDetail();
    });

    els.usersMaxPoints.addEventListener("input", () => {
      state.usersFilters.maxPoints = els.usersMaxPoints.value;
      renderUsersTable();
      renderUserDetail();
    });

    els.usersExpiringDays.addEventListener("input", () => {
      state.usersFilters.expiringDays = els.usersExpiringDays.value;
      renderUsersTable();
      renderUserDetail();
    });

    els.usersPhoneFilter.addEventListener("input", () => {
      state.usersFilters.phone = els.usersPhoneFilter.value;
      renderUsersTable();
      renderUserDetail();
    });

    els.usersResetFilters.addEventListener("click", () => {
      state.usersFilters = {
        minPoints: "",
        maxPoints: "",
        expiringDays: "",
        phone: "",
      };
      els.usersMinPoints.value = "";
      els.usersMaxPoints.value = "";
      els.usersExpiringDays.value = "";
      els.usersPhoneFilter.value = "";
      renderUsersTable();
      renderUserDetail();
    });

    els.usersTableBody.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='view-user']");
      if (!button) {
        return;
      }
      state.selectedUserId = button.dataset.userId;
      renderUserDetail();
    });
  }

  function initDefaultValues() {
    fillTypeAndRewardFilters();

    state.tasksFilters.type = "all";
    state.tasksFilters.reward = "all";

    els.tasksTypeFilter.value = "all";
    els.tasksRewardFilter.value = "all";

    state.completion.taskId = state.tasks.find((task) => !task.archived)?.id || "";

    renderConditionFields(els.taskType.value);
    renderRewardSections();
    renderStatusMode();
    resetTaskForm();
  }

  function init() {
    bindGlobalEvents();
    bindTasksScreenEvents();
    bindEditorEvents();
    bindCompletionEvents();
    bindUsersEvents();
    initDefaultValues();

    switchScreen("tasks");
    renderTasksScreen();
    renderCompletionScreen();
    renderUsersScreen();
  }

  init();
})();
