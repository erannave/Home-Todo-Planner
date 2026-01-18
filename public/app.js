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
    authEmail: "",
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

      if (!this.authEmail || !this.authEmail.includes("@")) {
        this.authError = "Please enter a valid email address";
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
            email: this.authEmail,
            password: this.authPassword,
          }),
        });
        const data = await res.json();
        if (data.error) {
          this.authError = data.error;
        } else {
          this.user = { email: data.email };
          this.authEmail = "";
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

      if (!this.authEmail || !this.authEmail.includes("@")) {
        this.authError = "Please enter a valid email address";
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
            email: this.authEmail,
            password: this.authPassword,
          }),
        });
        const data = await res.json();
        if (data.error) {
          this.authError = data.error;
        } else {
          this.user = { email: data.email };
          this.authEmail = "";
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
        filtered = filtered.filter((t) => t.status === this.filterStatus);
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
      if (!this.groupByCategory) return null;

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
      // Non-recurring task status text
      if (!task.is_recurring) {
        if (task.status === "pending") {
          return task.due_date
            ? `Due: ${this.formatDate(task.due_date)}`
            : "Pending";
        }
        return "Overdue";
      }
      // Recurring task status text
      if (task.status === "done")
        return `Done - Next: ${this.formatDate(task.next_due)}`;
      if (task.status === "pending") return "Due Today";
      return `Overdue - ${this.formatDate(task.next_due)}`;
    },

    getStatusForDay(task, daysFromToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysFromToday);

      const nextDue = new Date(task.next_due);
      nextDue.setHours(0, 0, 0, 0);

      const daysUntilDue = Math.ceil(
        (nextDue - targetDate) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilDue > 0) return "done";
      if (daysUntilDue === 0) return "pending";
      return "overdue";
    },

    get7DayPreview(task) {
      const weekdays = ["S", "M", "T", "W", "T", "F", "S"];
      const today = new Date();
      return [0, 1, 2, 3, 4, 5, 6].map((i) => {
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
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60)
        return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
      if (diffHours < 24)
        return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
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
      };
      this.showTaskModal = true;
    },

    async saveTask() {
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

    async deleteTask(id) {
      if (!confirm("Are you sure you want to delete this task?")) return;
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
      if (!confirm("Are you sure you want to delete this category?")) return;
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
      if (!confirm("Are you sure you want to remove this member?")) return;
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
      if (!confirm("Are you sure you want to delete this history entry?"))
        return;
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
      if (
        !confirm(
          "Are you sure you want to clear all history? This cannot be undone.",
        )
      )
        return;
      try {
        const res = await fetch("/api/history", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to clear history");
        this.showToast("History cleared");
      } catch {
        this.showToast("Failed to clear history", "error");
      }
      await this.loadData();
    },
  };
}
