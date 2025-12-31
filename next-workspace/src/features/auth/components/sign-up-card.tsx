import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { SignInFlow } from "../types";
import { useState } from "react";

interface SignUpCardProps {
    setState: (state: SignInFlow) => void;
};

export const SignUpCard = ({setState}: SignUpCardProps) => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")

    return (
        <Card className="w-full h-full p-8">
            <CardHeader className="px-0 pt-0">
                <CardTitle>
                    Sign Up to continue
                </CardTitle>
                <CardDescription>
                Use your eamil or other service to continue
                </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-5 px-0 pb-0">
                <form className="space-y-2.5">
                    <Input
                        disabled={false}
                        value={email}
                        onChange={(e)=>setEmail(e.target.value)}
                        placeholder="Email"
                        type="email"
                        required
                    />

                    <Input
                        disabled={false}
                        value={password}
                        onChange={(e)=>setPassword(e.target.value)}
                        placeholder="Password"
                        type="password"
                        required
                    />

                    <Input
                        disabled={false}
                        value={confirmPassword}
                        onChange={(e)=>setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                        type="password"
                        required
                    />

                    <Button type="submit" 
                            className="w-full"
                            size="lg"
                            disabled>
                        Continue
                    </Button>

                </form>

                <Separator/>

                <div className="flex flex-col gap-y-2.5">
                    <Button
                        disabled
                        onClick={()=>{}}
                        variant={"outline"}
                        size={"lg"}
                        className="w-full relative"
                    >
                        {/* className="size-5 absolute top-2.5 left-2.5" */}
                        <FcGoogle className="size-5"/>
                        Continue with Google
                    </Button>

                    <Button
                        disabled
                        onClick={()=>{}}
                        variant={"outline"}
                        size={"lg"}
                        className="w-full relative"
                    >
                        {/* className="size-5 absolute top-2.5 left-2.5" */}
                        <FaGithub className="size-5"/>
                        Continue with Github
                    </Button>

                </div>

                <p className="text-s text-muted-foreground">
                    Already have an account? <span onClick={()=> setState("signIn")} className="text-sky-700 hover:underline cursor-pointer">Log In</span>
                </p>


            </CardContent>
        </Card>
    );
}