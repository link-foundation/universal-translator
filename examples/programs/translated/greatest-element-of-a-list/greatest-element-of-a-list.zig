// Greatest element of a list in Zig

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    const numbers: [7]i64 = .{ 17, 4, 93, 28, 65, 3, 80 };
    var greatest: i64 = numbers[0];
    var index: i64 = 0;
    while (index < @as(i64, @intCast(numbers.len))) : (index += 1) {
        const number: i64 = numbers[@intCast(index)];
        if (number > greatest) {
            greatest = number;
        }
    }
    out.print("The greatest element is {d}\n", .{greatest}) catch {};
}
