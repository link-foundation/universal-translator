// Linear search in Zig: find the position of a value in a list

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    const numbers: [8]i64 = .{ 31, 41, 59, 26, 53, 58, 97, 93 };
    const wanted: i64 = 53;
    var position: i64 = -1;
    var current: i64 = 0;
    var index: i64 = 0;
    while (index < @as(i64, @intCast(numbers.len))) : (index += 1) {
        const number: i64 = numbers[@intCast(index)];
        if (number == wanted and position < 0) {
            position = current;
        }
        current += 1;
    }
    out.print("Found {d} at position {d}\n", .{ wanted, position }) catch {};
}
