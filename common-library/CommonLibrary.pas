{ Standard-output operations of the common library for Pascal. }
unit CommonLibrary;

interface

procedure PrintLine(Text: String);
procedure WriteText(Text: String);
procedure WriteInteger(Integer: Int64);
procedure EndLine;

implementation

procedure PrintLine(Text: String);
begin
    WriteLn(Text);
end;

procedure WriteText(Text: String);
begin
    Write(Text);
end;

procedure WriteInteger(Integer: Int64);
begin
    Write(Integer);
end;

procedure EndLine;
begin
    WriteLn;
end;

end.
