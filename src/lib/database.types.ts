export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      lesson_packages: {
        Row: {
          created_at: string;
          id: string;
          price: number | null;
          status: string;
          student_id: string;
          teacher_id: string;
          title: string;
          total_lessons: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          price?: number | null;
          status?: string;
          student_id: string;
          teacher_id: string;
          title: string;
          total_lessons: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          price?: number | null;
          status?: string;
          student_id?: string;
          teacher_id?: string;
          title?: string;
          total_lessons?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_packages_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_packages_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          notes: string | null;
          package_id: string;
          rescheduled_from_id: string | null;
          scheduled_at: string;
          sequence_number: number | null;
          status: string;
          teacher_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          package_id: string;
          rescheduled_from_id?: string | null;
          scheduled_at: string;
          sequence_number?: number | null;
          status?: string;
          teacher_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          package_id?: string;
          rescheduled_from_id?: string | null;
          scheduled_at?: string;
          sequence_number?: number | null;
          status?: string;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "lesson_packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_rescheduled_from_id_fkey";
            columns: ["rescheduled_from_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          teacher_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          teacher_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          teacher_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type LessonStatus =
  | "scheduled"
  | "completed"
  | "missed"
  | "cancelled"
  | "rescheduled";

export type Student = Database["public"]["Tables"]["students"]["Row"];
export type LessonPackage = Database["public"]["Tables"]["lesson_packages"]["Row"];
export type Lesson = Database["public"]["Tables"]["lessons"]["Row"];
