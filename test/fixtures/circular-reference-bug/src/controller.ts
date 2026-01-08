import { Controller, Get } from "adorn-api";

type ManyToManyCollection<T, P> = T[];

interface Student {
  id: number;
  name: string;
}

interface Course {
  id: number;
  title: string;
}

interface Enrollment {
  id: number;
  studentId: number;
  courseId: number;
  enrolledAt: Date;
}

@Controller("/courses")
export class CoursesController {
  @Get("/:id")
  async getCourseStudents(id: number): Promise<{
    course: Course;
    students: ManyToManyCollection<Student, Enrollment>;
  }> {
    return {
      course: { id, title: "Math 101" },
      students: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    };
  }
}
