import { Dto, Errors, Field, OmitDto, PartialDto, PickDto, t } from "../../src";

@Dto({ description: "Task returned by the API." })
export class TaskDto {
  @Field(t.integer({ description: "Task identifier." }))
  id!: number;

  @Field(t.string({ minLength: 1 }))
  title!: string;

  @Field(t.boolean())
  completed!: boolean;

  @Field(t.dateTime({ description: "Creation timestamp." }))
  createdAt!: string;
}

export interface CreateTaskDto
  extends Omit<TaskDto, "id" | "createdAt" | "completed"> {
  completed?: boolean;
}

@OmitDto(TaskDto, ["id", "createdAt"], {
  overrides: {
    completed: { optional: true }
  }
})
export class CreateTaskDto {}

export interface ReplaceTaskDto extends Omit<TaskDto, "id" | "createdAt"> {}

@OmitDto(TaskDto, ["id", "createdAt"])
export class ReplaceTaskDto {}

export interface UpdateTaskDto extends Partial<ReplaceTaskDto> {}

@PartialDto(ReplaceTaskDto)
export class UpdateTaskDto {}

export interface TaskParamsDto extends Pick<TaskDto, "id"> {}

@PickDto(TaskDto, ["id"])
export class TaskParamsDto {}

@Dto()
export class TaskQueryDto {
  @Field(t.optional(t.integer({ minimum: 0 })))
  offset?: number;

  @Field(t.optional(t.integer({ minimum: 1, maximum: 100 })))
  limit?: number;

  @Field(t.optional(t.boolean()))
  completed?: boolean;
}

@Dto()
class ErrorDto {
  @Field(t.string())
  message!: string;
}

export const TaskErrors = Errors(ErrorDto, [
  { status: 400, description: "Invalid id." },
  { status: 404, description: "Not found." }
]);
