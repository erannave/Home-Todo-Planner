// Constants
const STORAGE_KEY = "homeTodoPlannerPrefs";
const DEFAULT_INTERVAL_DAYS = 7;
const DEFAULT_CATEGORY_COLOR = "#6b7280";
const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];
const TOAST_DURATION_MS = 3000;
const ERROR_DURATION_MS = 5000;

// biome-ignore lint/correctness/noUnusedVariables: Used by Alpine.js via x-data="app()" in HTML
function app() {
  return {
    user: null,
    isLogin: true,
    authUsername: "",
    authPassword: "",
    authConfirmPassword: "",
    authError: "",
    currentPage: "dashboard",
    tasks: [],
    categories: [],
    members: [],
    history: [],
    filterStatus: "all",
    filterCategory: "all",
    filterMember: "all",
    groupByCategory: true,
    completingTaskId: null,
    selectedMemberId: "",
    customCompletionDate: "",
    showDatePicker: false,
    showTaskModal: false,
    showCategoryModal: false,
    showMemberModal: false,
    showPostponeModal: false,
    postponeDays: 7,
    editingTaskId: null,
    editingCategoryId: null,
    editingMemberId: null,
    taskForm: {
      name: "",
      notes: "",
      interval_days: DEFAULT_INTERVAL_DAYS,
      category_id: "",
      assigned_member_id: "",
      is_recurring: true,
      due_date: "",
      recurrence_type: "interval",
      recurrence_day: 1,
    },
    categoryForm: { name: "", color: DEFAULT_CATEGORY_COLOR },
    memberForm: { name: "" },
    presetColors: PRESET_COLORS,
    allowSignups: true,
    // Loading and feedback state
    loading: false,
    loadingMessage: "",
    errorMessage: "",
    toast: { show: false, message: "", type: "success" },

    // Confirm modal state
    confirmModal: {
      show: false,
      title: "",
      message: "",
      confirmText: "Delete",
      confirmClass: "bg-red-600 hover:bg-red-700",
      resolve: null,
    },

    // History stats
    weeklyStats: [],
    dayOfWeekStats: [],
    taskHealthStats: [],
    historyStatsLoading: false,
    weeklyChart: null,
    dayOfWeekChart: null,
    taskHealthChart: null,

    showToast(message, type = "success") {
      this.toast = { show: true, message, type };
      setTimeout(() => {
        this.toast.show = false;
      }, TOAST_DURATION_MS);
    },

    showError(msg) {
      this.errorMessage = msg;
      setTimeout(() => {
        this.errorMessage = "";
      }, ERROR_DURATION_MS);
    },

    showConfirm(options = {}) {
      return new Promise((resolve) => {
        this.confirmModal = {
          show: true,
          title: options.title || "Confirm",
          message: options.message || "Are you sure?",
          confirmText: options.confirmText || "Delete",
          confirmClass:
            options.confirmClass ||
            "bg-red-600 hover:bg-red-700 focus:ring-red-500",
          resolve,
        };
      });
    },

    handleConfirm(confirmed) {
      if (this.confirmModal.resolve) {
        this.confirmModal.resolve(confirmed);
      }
      this.confirmModal.show = false;
      this.confirmModal.resolve = null;
    },

    loadPreferences() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const prefs = JSON.parse(saved);
          this.filterStatus = prefs.filterStatus || "all";
          this.filterCategory = prefs.filterCategory || "all";
          this.filterMember = prefs.filterMember || "all";
          this.groupByCategory = prefs.groupByCategory !== false;
        }
      } catch (e) {
        console.warn("Failed to load preferences:", e);
      }
    },

    savePreferences() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            filterStatus: this.filterStatus,
            filterCategory: this.filterCategory,
            filterMember: this.filterMember,
            groupByCategory: this.groupByCategory,
          }),
        );
      } catch (e) {
        console.warn("Failed to save preferences:", e);
      }
    },

    async init() {
      this.loadPreferences();
      this.$watch("filterStatus", () => this.savePreferences());
      this.$watch("filterCategory", () => this.savePreferences());
      this.$watch("filterMember", () => this.savePreferences());
      this.$watch("groupByCategory", () => this.savePreferences());

      const [meRes, configRes] = await Promise.all([
        fetch("/api/me"),
        fetch("/api/config"),
      ]);
      const meData = await meRes.json();
      const configData = await configRes.json();
      this.allowSignups = configData.allowSignups;
      if (!this.allowSignups) {
        this.isLogin = true;
      }
      if (meData.user) {
        this.user = meData.user;
        await this.loadData();
      }
    },

    async loadData() {
      this.loading = true;
      this.loadingMessage = "Loading data...";
      try {
        const [tasksRes, categoriesRes, membersRes, historyRes] =
          await Promise.all([
            fetch("/api/tasks"),
            fetch("/api/categories"),
            fetch("/api/members"),
            fetch("/api/history"),
          ]);

        if (
          !tasksRes.ok ||
          !categoriesRes.ok ||
          !membersRes.ok ||
          !historyRes.ok
        ) {
          throw new Error("Failed to load data");
        }

        this.tasks = await tasksRes.json();
        this.categories = await categoriesRes.json();
        this.members = await membersRes.json();
        this.history = await historyRes.json();
      } catch {
        this.showError("Failed to load data. Please refresh the page.");
      } finally {
        this.loading = false;
        this.loadingMessage = "";
      }
    },

    async register() {
      this.authError = "";

      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (
        !this.authUsername ||
        this.authUsername.length < 3 ||
        this.authUsername.length > 20 ||
        !usernameRegex.test(this.authUsername)
      ) {
        this.authError =
          "Username must be 3-20 characters, letters, numbers and underscores only";
        return;
      }

      if (this.authPassword.length < 6) {
        this.authError = "Password must be at least 6 characters";
        return;
      }

      if (this.authPassword !== this.authConfirmPassword) {
        this.authError = "Passwords do not match";
        return;
      }

      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.authUsername,
            password: this.authPassword,
          }),
        });
        const data = await res.json();
        if (data.error) {
          this.authError = data.error;
        } else {
          this.user = { username: data.username };
          this.authUsername = "";
          this.authPassword = "";
          this.authConfirmPassword = "";
          await this.loadData();
        }
      } catch {
        this.authError = "Registration failed. Please try again.";
      }
    },

    async login() {
      this.authError = "";

      if (!this.authUsername) {
        this.authError = "Please enter your username";
        return;
      }

      if (!this.authPassword) {
        this.authError = "Please enter your password";
        return;
      }

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: this.authUsername,
            password: this.authPassword,
          }),
        });
        const data = await res.json();
        if (data.error) {
          this.authError = data.error;
        } else {
          this.user = { username: data.username };
          this.authUsername = "";
          this.authPassword = "";
          await this.loadData();
        }
      } catch {
        this.authError = "Login failed. Please try again.";
      }
    },

    async logout() {
      await fetch("/api/logout", { method: "POST" });
      this.user = null;
      this.tasks = [];
      this.categories = [];
      this.members = [];
      this.history = [];
    },

    get uniqueCategories() {
      return [
        ...new Set(
          this.tasks.filter((t) => t.category_name).map((t) => t.category_name),
        ),
      ].sort();
    },

    get taskStats() {
      const stats = {
        overdue: 0,
        pending: 0,
        done: 0,
        total: this.tasks.length,
      };
      for (const task of this.tasks) {
        if (task.status === "overdue") stats.overdue++;
        else if (task.status === "pending") stats.pending++;
        else if (task.status === "done") stats.done++;
      }
      return stats;
    },

    get filteredTasks() {
      let filtered = this.tasks;
      if (this.filterStatus !== "all") {
        if (this.filterStatus === "action-needed") {
          filtered = filtered.filter(
            (t) => t.status === "overdue" || t.status === "pending",
          );
        } else {
          filtered = filtered.filter((t) => t.status === this.filterStatus);
        }
      }
      if (this.filterCategory !== "all") {
        filtered = filtered.filter(
          (t) => t.category_name === this.filterCategory,
        );
      }
      if (this.filterMember !== "all") {
        if (this.filterMember === "unassigned") {
          filtered = filtered.filter((t) => !t.assigned_member_id);
        } else {
          filtered = filtered.filter(
            (t) => t.assigned_member_id === parseInt(this.filterMember, 10),
          );
        }
      }
      return filtered.sort((a, b) => {
        const order = { overdue: 0, pending: 1, done: 2 };
        return order[a.status] - order[b.status];
      });
    },

    get groupedTasks() {
      const tasks = this.filteredTasks;
      if (!this.groupByCategory) return [];

      const groups = new Map();
      for (const task of tasks) {
        const key = task.category_id || "uncategorized";
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            name: task.category_name || "No Category",
            color: task.category_color || "#6b7280",
            tasks: [],
          });
        }
        groups.get(key).tasks.push(task);
      }

      return Array.from(groups.values()).sort((a, b) => {
        if (a.id === "uncategorized") return 1;
        if (b.id === "uncategorized") return -1;
        return a.name.localeCompare(b.name);
      });
    },

    getStatusText(task) {
      // Non-recurring tasks
      if (!task.is_recurring) {
        if (task.status === "overdue") return "Overdue";
        return task.due_date
          ? `Due: ${this.formatDate(task.due_date)}`
          : "Pending";
      }

      // Recurring tasks
      if (task.status === "done")
        return `Done - Next: ${this.formatDate(task.next_due)}`;
      if (task.status === "pending") return "Due Today";
      return `Overdue - ${this.formatDate(task.next_due)}`;
    },

    recurrenceText(task) {
      const n = task.interval_days || 1;
      if (task.recurrence_type === "weekly") {
        const days = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];
        const dayName = days[task.recurrence_day] ?? "";
        return n === 1
          ? `Weekly on ${dayName}`
          : `Every ${n} weeks on ${dayName}`;
      }
      if (task.recurrence_type === "monthly") {
        const day = task.recurrence_day;
        const ordinal = this.ordinalSuffix(day);
        return n === 1
          ? `Monthly on the ${day}${ordinal}`
          : `Every ${n} months on the ${day}${ordinal}`;
      }
      return `Every ${task.interval_days} days`;
    },

    ordinalSuffix(n) {
      const tens = n % 100;
      if (tens >= 11 && tens <= 13) return "th";
      switch (n % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    },

    getStatusForDay(task, daysFromToday) {
      const MS_PER_DAY = 1000 * 60 * 60 * 24;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysFromToday);

      // Non-recurring tasks without due date are always overdue
      if (!task.is_recurring && !task.due_date) return "overdue";

      // Determine reference date (due_date for non-recurring, next_due for recurring)
      const referenceDate = new Date(
        task.is_recurring ? task.next_due : task.due_date,
      );
      referenceDate.setHours(0, 0, 0, 0);

      const daysUntilDue = Math.ceil((referenceDate - targetDate) / MS_PER_DAY);

      if (daysUntilDue > 0) return "done";
      if (daysUntilDue === 0) return "pending";
      return "overdue";
    },

    getDaysUntilDue(task) {
      const MS_PER_DAY = 1000 * 60 * 60 * 24;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Non-recurring tasks without due date
      if (!task.is_recurring && !task.due_date) {
        return 0; // Show only today (overdue)
      }

      // Determine reference date (due_date for non-recurring, next_due for recurring)
      const referenceDate = new Date(
        task.is_recurring ? task.next_due : task.due_date,
      );
      referenceDate.setHours(0, 0, 0, 0);

      const daysUntilDue = Math.ceil((referenceDate - today) / MS_PER_DAY);
      return daysUntilDue;
    },

    get8DayPreview(task) {
      const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
      const today = new Date();

      // Calculate how many days to show
      const daysUntilDue = this.getDaysUntilDue(task);

      // For overdue or due today, show only 1 day
      // For future tasks, show up to the due date (inclusive) with max of 8 days
      const numDays = daysUntilDue <= 0 ? 1 : Math.min(daysUntilDue + 1, 8);

      return Array.from({ length: numDays }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        return {
          day: i,
          status: this.getStatusForDay(task, i),
          isToday: i === 0,
          weekday: weekdays[date.getDay()],
        };
      });
    },

    formatDate(dateStr) {
      const date = new Date(dateStr);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const diffDays = Math.ceil((targetDay - today) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Tomorrow";
      if (diffDays === -1) return "Yesterday";
      if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
      if (diffDays < 7) return `In ${diffDays} days`;
      return date.toLocaleDateString();
    },

    formatRelativeTime(dateStr) {
      const pluralize = (n, unit) => `${n} ${unit}${n !== 1 ? "s" : ""} ago`;

      const date = new Date(dateStr);
      const diffMs = Date.now() - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return pluralize(diffMins, "minute");
      if (diffHours < 24) return pluralize(diffHours, "hour");
      if (diffDays < 7) return pluralize(diffDays, "day");
      return date.toLocaleDateString();
    },

    async completeTask(id) {
      const body = { completed_by_member_id: this.selectedMemberId || null };
      if (this.customCompletionDate) {
        body.completed_at = this.customCompletionDate;
      }
      try {
        const res = await fetch(`/api/tasks/${id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to complete task");
        this.showToast("Task marked as done!");

        // Fireworks animation
        if (typeof window.confetti === "function") {
          window.confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      } catch {
        this.showToast("Failed to complete task", "error");
      }
      this.completingTaskId = null;
      this.selectedMemberId = "";
      this.customCompletionDate = "";
      this.showDatePicker = false;
      await this.loadData();
    },

    openTaskModal() {
      this.editingTaskId = null;
      this.taskForm = {
        name: "",
        notes: "",
        interval_days: DEFAULT_INTERVAL_DAYS,
        category_id: "",
        assigned_member_id: "",
        is_recurring: true,
        due_date: "",
        recurrence_type: "interval",
        recurrence_day: 1,
      };
      this.showTaskModal = true;
    },

    editTask(task) {
      this.editingTaskId = task.id;
      this.taskForm = {
        name: task.name,
        notes: task.notes || "",
        interval_days: task.interval_days || DEFAULT_INTERVAL_DAYS,
        category_id: task.category_id || "",
        assigned_member_id: task.assigned_member_id || "",
        is_recurring: !!task.is_recurring,
        due_date: task.due_date || "",
        recurrence_type: task.recurrence_type || "interval",
        recurrence_day: task.recurrence_day ?? 1,
      };
      this.showTaskModal = true;
    },

    async saveTask() {
      const recurrenceType = this.taskForm.is_recurring
        ? this.taskForm.recurrence_type
        : "interval";
      const data = {
        name: this.taskForm.name,
        notes: this.taskForm.notes || null,
        interval_days: this.taskForm.is_recurring
          ? this.taskForm.interval_days
          : null,
        is_recurring: this.taskForm.is_recurring,
        due_date: this.taskForm.is_recurring
          ? null
          : this.taskForm.due_date || null,
        category_id: this.taskForm.category_id || null,
        assigned_member_id: this.taskForm.assigned_member_id || null,
        recurrence_type: recurrenceType,
        recurrence_day:
          recurrenceType === "weekly" || recurrenceType === "monthly"
            ? this.taskForm.recurrence_day
            : null,
      };
      try {
        const url = this.editingTaskId
          ? `/api/tasks/${this.editingTaskId}`
          : "/api/tasks";
        const method = this.editingTaskId ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to save task");
        this.showToast(this.editingTaskId ? "Task updated!" : "Task created!");
        this.showTaskModal = false;
      } catch {
        this.showToast("Failed to save task", "error");
      }
      await this.loadData();
    },

    openPostponeModal() {
      this.postponeDays = 7;
      this.showPostponeModal = true;
    },

    async postponeAllTasks() {
      const days = Number(this.postponeDays);
      if (!Number.isInteger(days) || days < 1) {
        this.showToast("Enter a whole number of days (1 or more)", "error");
        return;
      }
      try {
        const res = await fetch("/api/tasks/postpone-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
        });
        if (!res.ok) throw new Error("Failed to postpone tasks");
        this.showToast(
          `Postponed all tasks by ${days} day${days === 1 ? "" : "s"}`,
        );
        this.showPostponeModal = false;
      } catch {
        this.showToast("Failed to postpone tasks", "error");
      }
      await this.loadData();
    },

    async deleteTask(id) {
      const confirmed = await this.showConfirm({
        title: "Delete Task",
        message: "Are you sure you want to delete this task?",
        confirmText: "Delete",
      });
      if (!confirmed) return;
      try {
        const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete task");
        this.showToast("Task deleted");
      } catch {
        this.showToast("Failed to delete task", "error");
      }
      await this.loadData();
    },

    openCategoryModal() {
      this.editingCategoryId = null;
      this.categoryForm = { name: "", color: DEFAULT_CATEGORY_COLOR };
      this.showCategoryModal = true;
    },

    editCategory(cat) {
      this.editingCategoryId = cat.id;
      this.categoryForm = {
        name: cat.name,
        color: cat.color || DEFAULT_CATEGORY_COLOR,
      };
      this.showCategoryModal = true;
    },

    async saveCategory() {
      try {
        const url = this.editingCategoryId
          ? `/api/categories/${this.editingCategoryId}`
          : "/api/categories";
        const method = this.editingCategoryId ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.categoryForm),
        });
        if (!res.ok) throw new Error("Failed to save category");
        this.showToast(
          this.editingCategoryId ? "Category updated!" : "Category created!",
        );
        this.showCategoryModal = false;
      } catch {
        this.showToast("Failed to save category", "error");
      }
      await this.loadData();
    },

    async deleteCategory(id) {
      const confirmed = await this.showConfirm({
        title: "Delete Category",
        message: "Are you sure you want to delete this category?",
        confirmText: "Delete",
      });
      if (!confirmed) return;
      try {
        const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete category");
        this.showToast("Category deleted");
      } catch {
        this.showToast("Failed to delete category", "error");
      }
      await this.loadData();
    },

    openMemberModal() {
      this.editingMemberId = null;
      this.memberForm = { name: "" };
      this.showMemberModal = true;
    },

    editMember(member) {
      this.editingMemberId = member.id;
      this.memberForm = { name: member.name };
      this.showMemberModal = true;
    },

    async saveMember() {
      try {
        const url = this.editingMemberId
          ? `/api/members/${this.editingMemberId}`
          : "/api/members";
        const method = this.editingMemberId ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.memberForm),
        });
        if (!res.ok) throw new Error("Failed to save member");
        this.showToast(
          this.editingMemberId ? "Member updated!" : "Member added!",
        );
        this.showMemberModal = false;
      } catch {
        this.showToast("Failed to save member", "error");
      }
      await this.loadData();
    },

    async deleteMember(id) {
      const confirmed = await this.showConfirm({
        title: "Remove Member",
        message: "Are you sure you want to remove this member?",
        confirmText: "Remove",
      });
      if (!confirmed) return;
      try {
        const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove member");
        this.showToast("Member removed");
      } catch {
        this.showToast("Failed to remove member", "error");
      }
      await this.loadData();
    },

    async deleteHistoryItem(id) {
      const confirmed = await this.showConfirm({
        title: "Delete History Entry",
        message: "Are you sure you want to delete this history entry?",
        confirmText: "Delete",
      });
      if (!confirmed) return;
      try {
        const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete history entry");
        this.showToast("History entry deleted");
      } catch {
        this.showToast("Failed to delete history entry", "error");
      }
      await this.loadData();
    },

    async clearHistory() {
      const confirmed = await this.showConfirm({
        title: "Clear All History",
        message:
          "Are you sure you want to clear all history? This cannot be undone.",
        confirmText: "Clear All",
      });
      if (!confirmed) return;
      try {
        const res = await fetch("/api/history", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to clear history");
        this.showToast("History cleared");
      } catch {
        this.showToast("Failed to clear history", "error");
      }
      await this.loadData();
      await this.loadHistoryStats();
    },

    async loadHistoryStats() {
      this.historyStatsLoading = true;
      try {
        const [weeklyRes, dayOfWeekRes, taskHealthRes] = await Promise.all([
          fetch("/api/history/stats/weekly"),
          fetch("/api/history/stats/day-of-week"),
          fetch("/api/history/stats/task-health"),
        ]);

        if (!weeklyRes.ok || !dayOfWeekRes.ok || !taskHealthRes.ok) {
          throw new Error("Failed to load history stats");
        }

        const weeklyData = await weeklyRes.json();
        const dayOfWeekData = await dayOfWeekRes.json();
        const taskHealthData = await taskHealthRes.json();

        this.weeklyStats = weeklyData.weeks;
        this.dayOfWeekStats = dayOfWeekData.days;
        this.taskHealthStats = taskHealthData.health;

        // Render charts after data is loaded (use nextTick to ensure DOM is ready)
        this.$nextTick(() => {
          this.renderWeeklyChart();
          this.renderDayOfWeekChart();
          this.renderTaskHealthChart();
        });
      } catch {
        console.error("Failed to load history stats");
      } finally {
        this.historyStatsLoading = false;
      }
    },

    renderWeeklyChart() {
      const canvas = document.getElementById("weeklyChart");
      if (!canvas || !this.weeklyStats.length) return;

      // Destroy existing chart if it exists
      if (this.weeklyChart) {
        this.weeklyChart.destroy();
      }

      const labels = this.weeklyStats.map((w) => {
        const date = new Date(w.week_start);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      });

      const data = this.weeklyStats.map((w) => w.count);

      this.weeklyChart = new Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Completions",
              data,
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              fill: true,
              tension: 0.3,
              pointBackgroundColor: "#3b82f6",
              pointBorderColor: "#fff",
              pointBorderWidth: 2,
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
              },
            },
          },
        },
      });
    },

    renderTaskHealthChart() {
      const canvas = document.getElementById("taskHealthChart");
      if (!canvas || !this.taskHealthStats.length) return;

      if (this.taskHealthChart) {
        this.taskHealthChart.destroy();
      }

      // Filter tasks that have at least one completion (actual_average_days is not null)
      const validStats = this.taskHealthStats.filter(
        (s) => s.actual_average_days !== null,
      );
      if (validStats.length === 0) return;

      const labels = validStats.map((s) => s.task_name);

      const targetData = validStats.map((s) => s.target_interval_days);
      // Fallback actual average to 0 if it's null (though we filtered them above)
      const actualData = validStats.map((s) => s.actual_average_days || 0);

      this.taskHealthChart = new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Target Interval (Days)",
              data: targetData,
              backgroundColor: "rgba(59, 130, 246, 0.7)", // blue-500
              borderColor: "#3b82f6",
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: "Actual Average (Days)",
              data: actualData,
              backgroundColor: actualData.map((val, i) =>
                val > targetData[i]
                  ? "rgba(239, 68, 68, 0.7)"
                  : "rgba(34, 197, 94, 0.7)",
              ), // red-500 if overdue, else green-500
              borderColor: actualData.map((val, i) =>
                val > targetData[i] ? "#ef4444" : "#22c55e",
              ),
              borderWidth: 1,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                afterLabel: (context) => {
                  if (context.datasetIndex === 1) {
                    // Actual average
                    const stat = validStats[context.dataIndex];
                    return `Overdue completions: ${stat.overdue_count}`;
                  }
                  return null;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Days",
              },
            },
          },
        },
      });
    },

    renderDayOfWeekChart() {
      const canvas = document.getElementById("dayOfWeekChart");
      if (!canvas || !this.dayOfWeekStats.length) return;

      // Destroy existing chart if it exists
      if (this.dayOfWeekChart) {
        this.dayOfWeekChart.destroy();
      }

      const labels = this.dayOfWeekStats.map((d) => d.name.substring(0, 3));
      const data = this.dayOfWeekStats.map((d) => d.count);

      this.dayOfWeekChart = new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Completions",
              data,
              backgroundColor: "#22c55e",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
              },
            },
          },
        },
      });
    },
  };
}
