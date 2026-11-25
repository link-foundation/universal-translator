// Standard-output operations of the common library for Zig.

const std = @import("std");

// Each operation writes straight to standard output, so the output of the
// library and of the program never wait in separate buffers.
fn write(bytes: []const u8) void {
    const io = std.Io.Threaded.global_single_threaded.io();
    std.Io.File.stdout().writeStreamingAll(io, bytes) catch {};
}

pub fn printLine(text: []const u8) void {
    write(text);
    write("\n");
}

pub fn writeText(text: []const u8) void {
    write(text);
}

pub fn writeInteger(integer: i64) void {
    var buffer: [24]u8 = undefined;
    write(std.fmt.bufPrint(&buffer, "{d}", .{integer}) catch unreachable);
}

pub fn endLine() void {
    write("\n");
}
