export type TaskRecord = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
};

let nextId = 1;
const tasks: TaskRecord[] = [
  {
    id: nextId++,
    title: "Sketch the REST surface",
    completed: false,
    createdAt: new Date().toISOString()
  },
  {
    id: nextId++,
    title: "Ship the first version",
    completed: true,
    createdAt: new Date().toISOString()
  }
];

type TaskFilters = {
  offset: number;
  limit: number;
  completed?: boolean;
};

export function listTasks({ offset, limit, completed }: TaskFilters) {
  let result = tasks;
  if (completed !== undefined) {
    result = result.filter((task) => task.completed === completed);
  }
  return result.slice(offset, offset + limit);
}

export function getTask(id: number) {
  return tasks.find((entry) => entry.id === id);
}

export function createTask(data: { title: string; completed?: boolean }) {
  const task: TaskRecord = {
    id: nextId++,
    title: data.title,
    completed: data.completed ?? false,
    createdAt: new Date().toISOString()
  };
  tasks.push(task);
  return task;
}

export function replaceTask(
  id: number,
  data: { title: string; completed: boolean }
) {
  const index = tasks.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return undefined;
  }
  const updated: TaskRecord = {
    id,
    title: data.title,
    completed: data.completed,
    createdAt: tasks[index].createdAt
  };
  tasks[index] = updated;
  return updated;
}

export function updateTask(
  id: number,
  data: { title?: string; completed?: boolean }
) {
  const task = tasks.find((entry) => entry.id === id);
  if (!task) {
    return undefined;
  }
  if (data.title !== undefined) {
    task.title = data.title;
  }
  if (data.completed !== undefined) {
    task.completed = data.completed;
  }
  return task;
}

export function removeTask(id: number) {
  const index = tasks.findIndex((entry) => entry.id === id);
  if (index === -1) {
    return false;
  }
  tasks.splice(index, 1);
  return true;
}
