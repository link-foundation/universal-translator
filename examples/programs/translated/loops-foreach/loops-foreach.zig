// Loops/Foreach in Zig: print every element of a collection

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    const numbers: [8]i64 = .{ 1, 1, 2, 3, 5, 8, 13, 21 };
    var index: i64 = 0;
    while (index < @as(i64, @intCast(numbers.len))) : (index += 1) {
        const number: i64 = numbers[@intCast(index)];
        out.print("{d}\n", .{number}) catch {};
    }
}
