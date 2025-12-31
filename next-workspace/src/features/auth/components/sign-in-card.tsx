import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { SignInFlow } from "../types";
import { useState } from "react";

interface SignInCardProps {
    setState: (state: SignInFlow) => void;
};


export const SignInCard = ({setState}: SignInCardProps) => {
    const [email, setEmail] = useState("")
    const [password, setPasswor] = useState("")
    
    
    return (
        <Card className="w-full h-full p-8">
            <CardHeader className="px-0 pt-0">
                <CardTitle>
                    Login to continue
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
                        onChange={(e)=>setPasswor(e.target.value)}
                        placeholder="Password"
                        type="password"
                        required
                    />

                    <Button type="submit" 
                            className="w-full"
                            size="lg"
                            >
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
                    Don&apos;t have an account? <span onClick={()=> setState("signUp")} className="text-sky-700 hover:underline cursor-pointer">Sign Up</span>
                </p>


            </CardContent>
        </Card>
    );
}