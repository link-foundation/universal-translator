const std = @import("std");

var out: *std.Io.Writer = undefined;

fn square(value: i64) i64 {
    return value * value;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    out.print("{d}\n", .{square(4)}) catch {};
}
