// Bubble sort in Zig: sort a list of numbers

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var numbers: [7]i64 = .{ 5, 3, 8, 1, 9, 2, 7 };
    const count: i64 = @as(i64, @intCast(numbers.len));
    var pass: i64 = 0;
    while (pass < count - 1) : (pass += 1) {
        var index: i64 = 0;
        while (index < count - 1 - pass) : (index += 1) {
            if (numbers[@intCast(index)] > numbers[@intCast(index + 1)]) {
                const swap: i64 = numbers[@intCast(index)];
                numbers[@intCast(index)] = numbers[@intCast(index + 1)];
                numbers[@intCast(index + 1)] = swap;
            }
        }
    }
    var position: i64 = 0;
    while (position < count) : (position += 1) {
        out.print("{d}\n", .{numbers[@intCast(position)]}) catch {};
    }
}
