tasks.register<Exec>("npmBuild") {
    environment("PATH", "/usr/local/bin:/usr/bin:/bin:" + System.getenv("PATH"))
    commandLine("npm", "run", "build")
}

tasks.register("assembleDebug") {
    dependsOn("npmBuild")
}

tasks.register("build") {
    dependsOn("npmBuild")
}
