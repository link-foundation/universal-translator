--  Standard-output operations of the common library for Ada.
with Ada.Text_IO; use Ada.Text_IO;

package body Common_Library is
    package Long_IO is new Integer_IO (Long_Long_Integer);

    procedure Print_Line (Text : String) is
    begin
        Put_Line (Text);
    end Print_Line;

    procedure Write_Text (Text : String) is
    begin
        Put (Text);
    end Write_Text;

    procedure Write_Integer (Number : Long_Long_Integer) is
    begin
        Long_IO.Put (Number, 0);
    end Write_Integer;

    procedure End_Line is
    begin
        New_Line;
    end End_Line;
end Common_Library;
