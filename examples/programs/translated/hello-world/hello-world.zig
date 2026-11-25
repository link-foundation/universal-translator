// Hello World in Zig
// print "Hello World!" into console followed by new line symbol by function call

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    out.print("Hello World!\n", .{}) catch {};
}
